import 'server-only'
/**
 * Webhooks de pagamento: idempotência (`webhook_eventos`, RF-PG-50) e aplicação
 * dos eventos neutros nos serviços. Usado pelas rotas /api/webhooks/pagarme e
 * /api/webhooks/asaas.
 */
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'
import type { EventoPagamento, Gateway } from '@/server/lib/pagamentos/tipos'
import {
  marcarPagamentoConfirmado, marcarPagamentoCancelado, marcarReembolsado, marcarContestado,
} from './sessoes'
import { aplicarEventoAssinatura } from './assinatura'
import { gatewayDe } from '@/server/lib/pagamentos'
import { atualizarSituacaoRecebedor } from './onboardingPagamento'

/** Sem dado de cartão e com documento mascarado — o payload fica guardado 1:1 para diagnóstico. */
function higienizar(v: unknown, chave = ''): unknown {
  if (Array.isArray(v)) return v.map(x => higienizar(x))
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !/^(creditCard(Number|Token)?|card|number|cvv|ccv|holder.*)$/i.test(k))
      .map(([k, x]) => [k, higienizar(x, k)]))
  }
  if (typeof v === 'string' && /cpf|cnpj|document/i.test(chave) && v.replace(/\D/g, '').length >= 11) {
    const d = v.replace(/\D/g, '')
    return `${d.slice(0, 3)}…${d.slice(-2)}`
  }
  return v
}

/**
 * Registra o evento. `duplicado` = já processado com sucesso antes → responder
 * 200 sem fazer nada. Evento que falhou antes volta como `novo` (reprocessa).
 */
export async function registrarEvento(gateway: Gateway, eventoId: string, tipo: string, payload: unknown): Promise<'novo' | 'duplicado'> {
  const { rows } = await db.query<{ processado_em: string | null; inserido: boolean }>(
    `INSERT INTO webhook_eventos (gateway, evento_id, tipo, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (gateway, evento_id) DO UPDATE SET recebido_em = webhook_eventos.recebido_em
     RETURNING processado_em, (xmax = 0) AS inserido`,
    [gateway, eventoId.slice(0, 120), tipo.slice(0, 80), JSON.stringify(higienizar(payload))],
  )
  const r = rows[0]
  if (!r?.inserido && r?.processado_em) return 'duplicado'
  return 'novo'
}

export async function concluirEvento(gateway: Gateway, eventoId: string, erro?: unknown): Promise<void> {
  await db.query(
    `UPDATE webhook_eventos
        SET processado_em = CASE WHEN $3::text IS NULL THEN NOW() ELSE NULL END, erro = $3
      WHERE gateway = $1 AND evento_id = $2`,
    [gateway, eventoId.slice(0, 120), erro == null ? null : String(erro instanceof Error ? erro.message : erro).slice(0, 2000)],
  ).catch(err => log.err('webhook.eventos', 'falha ao concluir evento', err))
}

/** Aplica um evento neutro. Idempotente por construção (cada handler é). */
export async function aplicarEventoPagamento(gateway: Gateway, ev: EventoPagamento): Promise<void> {
  switch (ev.tipo) {
    case 'cobranca.paga':
      return marcarPagamentoConfirmado(
        { gateway, cobrancaId: ev.cobrancaId, parcelamentoId: ev.parcelamentoId, sessaoId: ev.referencia },
        { liquidoCentavos: ev.liquidoCentavos, valorCentavos: ev.valorCentavos, parcelas: ev.parcelas },
      )
    case 'cobranca.falhou':
    case 'cobranca.vencida':
    case 'cobranca.cancelada':
      return marcarPagamentoCancelado({ gateway, cobrancaId: ev.cobrancaId, parcelamentoId: ev.parcelamentoId, sessaoId: ev.referencia })
    case 'cobranca.reembolsada':
      return marcarReembolsado({ gateway, cobrancaId: ev.cobrancaId, parcelamentoId: ev.parcelamentoId, sessaoId: ev.referencia }, ev.parcial)
    case 'cobranca.contestada':
      return marcarContestado({ gateway, cobrancaId: ev.cobrancaId, parcelamentoId: ev.parcelamentoId, sessaoId: ev.referencia })
    case 'cobranca.split_bloqueado':
      // Split maior que o líquido no recebimento: o Asaas bloqueia e dá 2 dias úteis.
      log.err('pagamento.webhook', `SPLIT BLOQUEADO (divergência) ${gateway} cobrança ${ev.cobrancaId} — corrigir no painel em até 2 dias úteis`, undefined)
      return
    case 'assinatura.paga': {
      /*
       * Asaas não manda o fim do ciclo no evento: pergunta a próxima cobrança à
       * assinatura, para a tela dizer "Renova em" a MESMA data que o Asaas cobra
       * (meio-dia em SP: sem virar o dia na conversão de fuso). Sem resposta,
       * `aplicarEventoAssinatura` calcula +1 ciclo como antes.
       */
      let fim = ev.cicloFim
      const g = gatewayDe(gateway)
      if (!fim && g.proximaCobranca) {
        const d = await g.proximaCobranca(ev.assinaturaId)
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) fim = `${d}T12:00:00-03:00`
      }
      return aplicarEventoAssinatura(ev.assinaturaId, 'renovado', fim, gateway, ev.vencimento ?? null)
    }
    case 'assinatura.falhou':
      return aplicarEventoAssinatura(ev.assinaturaId, 'falhou', null, gateway)
    case 'assinatura.cancelada':
      return aplicarEventoAssinatura(ev.assinaturaId, 'cancelado', null, gateway)
    case 'recebedor.situacao':
      await atualizarSituacaoRecebedor(gateway, ev.recebedorId, ev.situacao, ev.detalhe)
      return
    case 'ignorado':
      return
  }
}
