/** `externalReference` das cobranças de sessão — o webhook acha a sessão por aqui também. */
export const refSessao = (sessaoId: string) => `sessao:${sessaoId}`
export const sessaoDeRef = (ref: string | null | undefined): string | null =>
  ref && ref.startsWith('sessao:') ? ref.slice(7) : null
/** `externalReference` do customer/assinatura do psicólogo. */
export const refPsicologo = (id: string) => `psicologo:${id}`
