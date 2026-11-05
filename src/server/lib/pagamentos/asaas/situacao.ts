import type { SituacaoRecebedor } from '../tipos'

export type StatusConta = {
  commercialInfo?: string; bankAccountInfo?: string; documentation?: string; general?: string
}

/**
 * Snapshot do Asaas (`GET /myAccount/status` ou `accountStatus` do webhook) →
 * situação neutra. Qualquer REJECTED → recusado; general=APPROVED → aprovado;
 * algo AWAITING_APPROVAL → em_analise; senão pendente.
 */
export function situacaoDeStatus(st: StatusConta | null | undefined): SituacaoRecebedor {
  if (!st) return 'pendente'
  const v = [st.commercialInfo, st.bankAccountInfo, st.documentation, st.general]
  if (v.includes('REJECTED')) return 'recusado'
  if (st.general === 'APPROVED') return 'aprovado'
  if (v.includes('AWAITING_APPROVAL')) return 'em_analise'
  return 'pendente'
}
