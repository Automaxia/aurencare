import 'server-only'
/**
 * Painel "Operação de pagamentos" do /admin (RF-PG-51 + alerta do D-08).
 * Só leitura — a correção continua nos fluxos de sempre (cron, webhook, Perfil).
 */
import { db } from '@/server/db/pool'
import { integrationStatus } from '@/server/lib/env'
import { log } from '@/server/lib/log'

/**
 * Reserva mínima de saldo na conta raiz do Asaas para estornos PIX (D-08: o
 * estorno PIX sai do saldo da raiz). Reais, por env; padrão R$ 500.
 */
const reservaMinimaCentavos = () =>
  Math.round(Math.max(0, Number(process.env.ASAAS_RESERVA_ESTORNO ?? 500) || 0) * 100)

export type PainelPagamentos = {
  saldo: {
    /** null = Asaas não configurado ou consulta falhou. */
    saldoCentavos: number | null
    reservaCentavos: number
    /** Soma dos estornos na fila (entra na reserva exigida). */
    filaCentavos: number
    abaixo: boolean
    erro: string | null
  }
  estornos: Array<{ sessaoId: string; psicologo: string; paciente: string; valor: number; metodo: string | null; desde: string; motivo: string | null; gateway: string | null }>
  subcontas: {
    contagem: Array<{ gateway: string; situacao: string; n: number }>
    pendentes: Array<{ psicologoId: string; nome: string; email: string; gateway: string; situacao: string; concluidoEm: string | null }>
  }
  semSplit: Array<{ sessaoId: string; psicologo: string; valor: number; metodo: string | null; gateway: string; cobranca: string; quando: string; status: string }>
  webhooks: {
    comErro: Array<{ gateway: string; tipo: string; eventoId: string; erro: string; recebidoEm: string }>
    divergenciaSplit: Array<{ eventoId: string; cobranca: string | null; recebidoEm: string }>
  }
}

async function saldoRaizCentavos(): Promise<{ v: number | null; erro: string | null }> {
  if (!integrationStatus.asaas) return { v: null, erro: 'Asaas não configurado neste ambiente.' }
  try {
    const { asaas } = await import('@/server/lib/pagamentos/asaas/cliente')
    const r = await asaas<{ balance?: number }>('GET', '/finance/balance')
    return { v: typeof r?.balance === 'number' ? Math.round(r.balance * 100) : null, erro: null }
  } catch (err) {
    log.err('admin.pagamentos', 'falha ao ler saldo da raiz', err)
    return { v: null, erro: 'Não foi possível consultar o saldo agora.' }
  }
}

export async function obterPainelPagamentos(): Promise<PainelPagamentos> {
  const [saldo, estornos, contagem, pendentes, semSplit, comErro, divergencia] = await Promise.all([
    saldoRaizCentavos(),
    db.query(
      `SELECT s.id, ps.nome AS psicologo, p.nome AS paciente, s.valor, s.pagamento_metodo,
              s.reembolso_pendente_em, s.reembolso_motivo, s.gateway
         FROM sessoes s
         JOIN psicologos ps ON ps.id = s.psicologo_id
         JOIN pacientes p ON p.id = s.paciente_id
        WHERE s.reembolso_pendente_em IS NOT NULL
        ORDER BY s.reembolso_pendente_em ASC
        LIMIT 100`,
    ),
    db.query(
      `SELECT COALESCE(recebedor_gateway, 'pagarme') AS gateway,
              COALESCE(recebedor_situacao, CASE WHEN recebedor_gateway = 'asaas' THEN 'pendente' ELSE 'sem_situacao' END) AS situacao,
              COUNT(*)::int AS n
         FROM psicologos
        WHERE COALESCE(recebedor_id, pagarme_recipient_id) IS NOT NULL
        GROUP BY 1, 2 ORDER BY 1, 2`,
    ),
    db.query(
      `SELECT id, nome, email, recebedor_gateway, COALESCE(recebedor_situacao, 'pendente') AS situacao, pgm_onboarding_em
         FROM psicologos
        WHERE recebedor_gateway = 'asaas' AND COALESCE(recebedor_situacao, 'pendente') <> 'aprovado'
        ORDER BY (recebedor_situacao = 'recusado') DESC NULLS LAST, pgm_onboarding_em ASC NULLS LAST
        LIMIT 100`,
    ),
    // Sem split = cobrança criada sem taxa administrativa (RF-PG-24: psicólogo sem subconta apta).
    db.query(
      `SELECT s.id, ps.nome AS psicologo, s.valor, s.pagamento_metodo, s.gateway, s.cobranca_id,
              COALESCE(s.pago_em, s.data_hora) AS quando, s.pagamento_status
         FROM sessoes s
         JOIN psicologos ps ON ps.id = s.psicologo_id
        WHERE s.cobranca_id IS NOT NULL AND s.cobranca_id NOT LIKE 'mock_%'
          AND COALESCE(s.comissao_centavos, 0) = 0 AND COALESCE(s.valor, 0) > 0
          AND s.data_hora > NOW() - INTERVAL '60 days'
        ORDER BY s.data_hora DESC
        LIMIT 100`,
    ),
    db.query(
      `SELECT gateway, tipo, evento_id, erro, recebido_em
         FROM webhook_eventos
        WHERE erro IS NOT NULL AND processado_em IS NULL
          AND recebido_em > NOW() - INTERVAL '7 days'
        ORDER BY recebido_em DESC
        LIMIT 100`,
    ),
    db.query(
      `SELECT evento_id, payload->'payment'->>'id' AS cobranca, recebido_em
         FROM webhook_eventos
        WHERE tipo = 'PAYMENT_SPLIT_DIVERGENCE_BLOCK' AND recebido_em > NOW() - INTERVAL '30 days'
        ORDER BY recebido_em DESC
        LIMIT 50`,
    ),
  ])

  const filaPixAsaas = estornos.rows
    .filter(r => r.gateway === 'asaas' && r.pagamento_metodo === 'pix')
    .reduce((a, r) => a + Math.round(Number(r.valor ?? 0) * 100), 0)
  const reserva = Math.max(reservaMinimaCentavos(), filaPixAsaas)

  return {
    saldo: {
      saldoCentavos: saldo.v,
      reservaCentavos: reserva,
      filaCentavos: filaPixAsaas,
      abaixo: saldo.v != null && saldo.v < reserva,
      erro: saldo.erro,
    },
    estornos: estornos.rows.map(r => ({
      sessaoId: r.id, psicologo: r.psicologo, paciente: r.paciente, valor: Number(r.valor ?? 0),
      metodo: r.pagamento_metodo, desde: new Date(r.reembolso_pendente_em).toISOString(),
      motivo: r.reembolso_motivo, gateway: r.gateway,
    })),
    subcontas: {
      contagem: contagem.rows.map(r => ({ gateway: r.gateway, situacao: r.situacao, n: r.n })),
      pendentes: pendentes.rows.map(r => ({
        psicologoId: r.id, nome: r.nome, email: r.email, gateway: r.recebedor_gateway,
        situacao: r.situacao, concluidoEm: r.pgm_onboarding_em ? new Date(r.pgm_onboarding_em).toISOString() : null,
      })),
    },
    semSplit: semSplit.rows.map(r => ({
      sessaoId: r.id, psicologo: r.psicologo, valor: Number(r.valor ?? 0), metodo: r.pagamento_metodo,
      gateway: r.gateway ?? 'pagarme', cobranca: r.cobranca_id, quando: new Date(r.quando).toISOString(), status: r.pagamento_status,
    })),
    webhooks: {
      comErro: comErro.rows.map(r => ({
        gateway: r.gateway, tipo: r.tipo, eventoId: r.evento_id, erro: String(r.erro).slice(0, 300),
        recebidoEm: new Date(r.recebido_em).toISOString(),
      })),
      divergenciaSplit: divergencia.rows.map(r => ({ eventoId: r.evento_id, cobranca: r.cobranca, recebidoEm: new Date(r.recebido_em).toISOString() })),
    },
  }
}
