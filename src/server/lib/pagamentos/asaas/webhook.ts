/**
 * Webhook do Asaas → evento neutro. sdd §4.3; spike §2 e §9.
 *
 * Sem `server-only` de propósito: é puro (sem rede/banco) e testável por script.
 */
import { timingSafeEqual } from 'node:crypto'
import { situacaoDeStatus } from './situacao'
import { sessaoDeRef } from './ref'
import type { EventoPagamento } from '../tipos'

/** `asaas-access-token` == ASAAS_WEBHOOK_TOKEN, em tempo constante. */
export function tokenConfere(recebido: string | null, esperado: string | undefined): 'ok' | 'invalido' | 'sem_config' {
  if (!esperado) return 'sem_config'
  if (!recebido) return 'invalido'
  const a = Buffer.from(recebido), b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'invalido'
}

const centavos = (v: unknown) => (v == null || v === '' ? undefined : Math.round(Number(v) * 100))

/**
 * - PIX no sandbox só emite `PAYMENT_RECEIVED`; cartão, `CONFIRMED` (e o
 *   `RECEIVED` ~32 dias depois). Os dois contam como pago; o serviço é idempotente.
 * - `eventoId` é a string INTEIRA (`evt_<hex>&<n>`): o hex se repete por tipo.
 * - `ACCOUNT_STATUS_*` chega fora de ordem: vale o snapshot `accountStatus`,
 *   nunca o nome do evento.
 */
export function normalizarEventoAsaas(p: any): EventoPagamento {
  const eventoId = String(p?.id ?? '')
  const ev = String(p?.event ?? '')
  if (!eventoId || !ev) return { tipo: 'ignorado', eventoId: eventoId || 'sem_id', motivo: 'payload sem id/event' }

  if (ev.startsWith('ACCOUNT_STATUS_')) {
    const st = p.accountStatus ?? {}
    const recebedorId = p.account?.id ?? st.id
    if (!recebedorId) return { tipo: 'ignorado', eventoId, motivo: 'ACCOUNT_STATUS sem conta' }
    return {
      tipo: 'recebedor.situacao', eventoId, recebedorId, situacao: situacaoDeStatus(st),
      detalhe: { commercialInfo: st.commercialInfo, bankAccountInfo: st.bankAccountInfo, documentation: st.documentation, general: st.general },
    }
  }

  if (ev === 'SUBSCRIPTION_INACTIVATED' || ev === 'SUBSCRIPTION_DELETED') {
    const id = p.subscription?.id
    return id ? { tipo: 'assinatura.cancelada', eventoId, assinaturaId: id } : { tipo: 'ignorado', eventoId, motivo: `${ev} sem subscription` }
  }

  if (!ev.startsWith('PAYMENT_')) return { tipo: 'ignorado', eventoId, motivo: ev }
  const pay = p.payment ?? {}
  if (!pay.id) return { tipo: 'ignorado', eventoId, motivo: `${ev} sem payment` }

  // Cobrança de assinatura (mensalidade do psicólogo).
  if (pay.subscription) {
    if (ev === 'PAYMENT_CONFIRMED' || ev === 'PAYMENT_RECEIVED') {
      return { tipo: 'assinatura.paga', eventoId, assinaturaId: pay.subscription, cicloFim: null, vencimento: pay.dueDate ?? null }
    }
    if (ev === 'PAYMENT_OVERDUE' || ev === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' || ev === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS') {
      return { tipo: 'assinatura.falhou', eventoId, assinaturaId: pay.subscription }
    }
    return { tipo: 'ignorado', eventoId, motivo: `${ev} (assinatura)` }
  }

  const base = {
    eventoId, cobrancaId: String(pay.id),
    parcelamentoId: pay.installment ?? null,
    referencia: sessaoDeRef(pay.externalReference),
  }
  switch (ev) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return { tipo: 'cobranca.paga', ...base, valorCentavos: centavos(pay.value), liquidoCentavos: centavos(pay.netValue) }
    case 'PAYMENT_OVERDUE':
      return { tipo: 'cobranca.vencida', ...base }
    case 'PAYMENT_DELETED':
      return { tipo: 'cobranca.cancelada', ...base }
    case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
      return { tipo: 'cobranca.falhou', ...base }
    case 'PAYMENT_REFUNDED':
      return { tipo: 'cobranca.reembolsada', ...base, parcial: false }
    case 'PAYMENT_PARTIALLY_REFUNDED':
      return { tipo: 'cobranca.reembolsada', ...base, parcial: true }
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
    case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      return { tipo: 'cobranca.contestada', ...base }
    case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK':
      return { tipo: 'cobranca.split_bloqueado', eventoId, cobrancaId: base.cobrancaId }
    default:
      return { tipo: 'ignorado', eventoId, motivo: ev }
  }
}
