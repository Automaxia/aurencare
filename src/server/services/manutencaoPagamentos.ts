import 'server-only'
/**
 * Rotinas de manutenção da camada de pagamentos (docs/asaas/tasks.md Fase 3,
 * P1 "Cron"). Cada uma é idempotente, limitada por lote e nunca lança: erro de
 * um item vira log e segue para o próximo. Agendadas in-process em
 * `src/server/lib/cron.ts` e expostas em `/api/cron/pagamentos` (disparo manual).
 *
 *  - repetirEstornosPendentes  D-08: estorno PIX recusado por falta de saldo na
 *                              raiz fica com `reembolso_pendente_em`; repete.
 *  - cancelarPixVencidos       D-05: o QR do Asaas vale 1 ano, a validade de
 *                              30 min é regra nossa — cancela no gateway.
 *  - reprocessarWebhooks       eventos do Asaas que falharam ao aplicar
 *                              (`webhook_eventos.erro`) voltam a ser aplicados.
 *  - reconciliarSubcontas      situação cadastral das subcontas não aprovadas
 *                              (rede de segurança do webhook ACCOUNT_STATUS_*).
 */
import { db } from '@/server/db/pool'
import { env, integrationStatus } from '@/server/lib/env'
import { log } from '@/server/lib/log'
import { decrypt } from '@/server/lib/crypto'
import { gatewayDe } from '@/server/lib/pagamentos'
import type { Gateway } from '@/server/lib/pagamentos'
import { ambienteAsaas } from '@/server/lib/pagamentos/asaas/cliente'
import { marcarPagamentoCancelado } from './sessoes'
import { atualizarSituacaoRecebedor } from './onboardingPagamento'
import { concluirEvento, aplicarEventoPagamento } from './eventosPagamento'

const LOTE = 50
/** Estorno pendente há mais que isto vira alerta para o admin (ação manual: saldo na raiz). */
const HORAS_ALERTA_ESTORNO = 24
/** Folga além do `cobranca_vence_em` antes de cancelar (pagamento em trânsito). */
const MIN_FOLGA_PIX = 5
/** Evento com erro mais velho que isto não é reprocessado (fica para análise). */
const DIAS_REPROCESSAR = 3

// ── D-08: estornos pendentes ────────────────────────────────────────────────
export async function repetirEstornosPendentes(): Promise<{ estornados: number; pendentes: number; falhas: number }> {
  const { rows } = await db.query<{
    id: string; gateway: Gateway | null; cobranca_id: string; cobranca_parcelamento_id: string | null; reembolso_pendente_em: string
  }>(
    `SELECT id, gateway, cobranca_id, cobranca_parcelamento_id, reembolso_pendente_em
       FROM sessoes
      WHERE reembolso_pendente_em IS NOT NULL
        AND pagamento_status = 'pago'
        AND cobranca_id IS NOT NULL
      ORDER BY reembolso_pendente_em ASC
      LIMIT ${LOTE}`,
  )
  let estornados = 0, pendentes = 0, falhas = 0
  const atrasados: string[] = []
  for (const r of rows) {
    try {
      const res = await gatewayDe(r.gateway).reembolsar({ cobrancaId: r.cobranca_id, parcelamentoId: r.cobranca_parcelamento_id })
      if (res.status === 'estornado' || res.status === 'solicitado') {
        // 'solicitado' (PIX, D-09): saldo já debitado; o webhook PAYMENT_REFUNDED confirma.
        await db.query(
          `UPDATE sessoes SET pagamento_status = 'reembolsado', reembolso_pendente_em = NULL, reembolso_motivo = NULL
            WHERE id = $1 AND pagamento_status = 'pago'`, [r.id])
        estornados++
        log.ok('cron.estornos', `sessão ${r.id}: estorno ${res.status} no ${r.gateway ?? 'pagarme'}`)
      } else {
        // 'pendente' ou 'falhou': mantém na fila com o motivo mais recente.
        await db.query(`UPDATE sessoes SET reembolso_motivo = $2 WHERE id = $1`, [r.id, res.motivo.slice(0, 500)])
        if (res.status === 'falhou') falhas++; else pendentes++
        if (Date.now() - Date.parse(r.reembolso_pendente_em) > HORAS_ALERTA_ESTORNO * 3600_000) atrasados.push(r.id)
      }
    } catch (err) {
      falhas++
      log.err('cron.estornos', `sessão ${r.id}`, err)
    }
  }
  if (atrasados.length) {
    await alertarAdmin(
      'estornos-atrasados',
      `${atrasados.length} estorno(s) de sessão pendente(s) há mais de ${HORAS_ALERTA_ESTORNO}h — provavelmente falta saldo na conta raiz do gateway (D-08). Sessões: ${atrasados.join(', ')}`,
    )
  }
  if (rows.length) log.info('cron.estornos', `${estornados} estornado(s) · ${pendentes} ainda pendente(s) · ${falhas} falha(s)`)
  return { estornados, pendentes, falhas }
}

// ── D-05: PIX vencido ───────────────────────────────────────────────────────
export async function cancelarPixVencidos(): Promise<{ cancelados: number }> {
  const { rows } = await db.query<{ id: string; gateway: Gateway; cobranca_id: string }>(
    `SELECT id, gateway, cobranca_id
       FROM sessoes
      WHERE gateway = 'asaas'
        AND pagamento_metodo = 'pix'
        AND COALESCE(pagamento_status, 'pendente') = 'pendente'
        AND cobranca_id IS NOT NULL
        AND cobranca_vence_em < NOW() - make_interval(mins => $1::int)
      ORDER BY cobranca_vence_em ASC
      LIMIT ${LOTE}`,
    [MIN_FOLGA_PIX],
  )
  let cancelados = 0
  for (const r of rows) {
    try {
      const g = gatewayDe(r.gateway)
      // Gateway sem cancelamento próprio expira sozinho (Pagar.me): nada a fazer.
      if (!g.cancelarCobranca) continue
      if (await g.cancelarCobranca(r.cobranca_id)) {
        // Não sobrescreve pago (guarda dentro de marcarPagamentoCancelado).
        await marcarPagamentoCancelado({ gateway: r.gateway, cobrancaId: r.cobranca_id, sessaoId: r.id })
        cancelados++
      }
    } catch (err) {
      log.err('cron.pix', `sessão ${r.id}`, err)
    }
  }
  if (cancelados) log.ok('cron.pix', `${cancelados} PIX vencido(s) cancelado(s)`)
  return { cancelados }
}

// ── webhook_eventos com erro ────────────────────────────────────────────────
export async function reprocessarWebhooks(): Promise<{ reprocessados: number; falhas: number }> {
  const { rows } = await db.query<{ gateway: Gateway; evento_id: string; payload: unknown }>(
    `SELECT gateway, evento_id, payload
       FROM webhook_eventos
      WHERE gateway = 'asaas'
        AND processado_em IS NULL
        AND erro IS NOT NULL
        AND recebido_em > NOW() - make_interval(days => $1::int)
      ORDER BY recebido_em ASC
      LIMIT ${LOTE}`,
    [DIAS_REPROCESSAR],
  )
  if (!rows.length) return { reprocessados: 0, falhas: 0 }
  // Import tardio: só o Asaas guarda payload normalizável (a Pagar.me reenvia sozinha).
  const { normalizarEventoAsaas } = await import('@/server/lib/pagamentos/asaas/webhook')
  let reprocessados = 0, falhas = 0
  for (const r of rows) {
    try {
      await aplicarEventoPagamento(r.gateway, normalizarEventoAsaas(r.payload))
      await concluirEvento(r.gateway, r.evento_id)
      reprocessados++
    } catch (err) {
      falhas++
      await concluirEvento(r.gateway, r.evento_id, err)
    }
  }
  log.info('cron.webhooks', `${reprocessados} evento(s) reprocessado(s) · ${falhas} ainda com erro`)
  return { reprocessados, falhas }
}

// ── situação das subcontas ──────────────────────────────────────────────────
export async function reconciliarSubcontas(): Promise<{ verificadas: number; mudaram: number }> {
  if (!integrationStatus.asaas) return { verificadas: 0, mudaram: 0 }
  const { rows } = await db.query<{ recebedor_id: string; recebedor_api_key: string; recebedor_situacao: string | null }>(
    `SELECT recebedor_id, recebedor_api_key, recebedor_situacao
       FROM psicologos
      WHERE recebedor_gateway = 'asaas'
        AND recebedor_api_key IS NOT NULL
        AND recebedor_ambiente = $1
        AND COALESCE(recebedor_situacao, 'pendente') NOT IN ('aprovado')
      LIMIT ${LOTE}`,
    [ambienteAsaas()],
  )
  const { lerSituacao } = await import('@/server/lib/pagamentos/asaas/recebedor')
  let mudaram = 0
  for (const r of rows) {
    try {
      const st = await lerSituacao(decrypt(r.recebedor_api_key))
      if (st.situacao !== r.recebedor_situacao) {
        await atualizarSituacaoRecebedor('asaas', r.recebedor_id, st.situacao, st.detalhe as unknown as Record<string, unknown>)
        mudaram++
      }
    } catch (err) {
      log.err('cron.subcontas', `subconta ${r.recebedor_id}`, err)
    }
  }
  if (rows.length) log.info('cron.subcontas', `${rows.length} verificada(s) · ${mudaram} mudaram de situação`)
  return { verificadas: rows.length, mudaram }
}

/** Todas, em sequência — usado pela rota manual. */
export async function manutencaoPagamentos() {
  return {
    estornos: await repetirEstornosPendentes(),
    pix: await cancelarPixVencidos(),
    webhooks: await reprocessarWebhooks(),
    subcontas: await reconciliarSubcontas(),
  }
}

/**
 * E-mail para ADMIN_ALERT_EMAIL, no máximo 1×/dia por `chave` (Redis). Sem
 * Redis/Resend/e-mail configurado vira só log. Nunca lança.
 */
async function alertarAdmin(chave: string, mensagem: string): Promise<void> {
  log.err('pagamentos.alerta', mensagem, undefined)
  try {
    if (!env.adminAlertEmail || !integrationStatus.resend) return
    const { redis } = await import('@/server/lib/redis')
    const r = await redis()
    if (r && (await r.set(`alerta:pagamentos:${chave}`, '1', { NX: true, EX: 86400 })) !== 'OK') return
    const { enviarEmail } = await import('@/server/lib/email')
    await enviarEmail({
      to: env.adminAlertEmail,
      subject: '⚠️ Audere — alerta de pagamentos',
      html: `<p>${mensagem.replace(/</g, '&lt;')}</p><p style="color:#888;font-size:12px">Alerta automático da manutenção de pagamentos (no máximo 1 por dia).</p>`,
    })
  } catch { /* best-effort */ }
}
