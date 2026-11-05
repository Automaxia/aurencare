/**
 * Taxa do gateway por sessão paga — fonte ÚNICA (antes havia três cópias da
 * tabela em financeiro.ts, exportacaoContabil.ts e visaoContabil.ts).
 *
 * Prioridade: a taxa REAL (`sessoes.taxa_gateway_centavos`, valor − líquido do
 * webhook, RF-PG-27). Sem ela, estimativa pela tabela do gateway de origem.
 *
 * Pagar.me: tabela padrão mai/2026 (percentual). Asaas: tabela da conta lida no
 * spike (04/11/2026, `GET /myAccount/fees`) — PIX é valor FIXO, não percentual.
 */
type Entrada = {
  gateway: string | null | undefined
  metodo: string | null | undefined
  parcelas?: number | null
  valor: number                 // reais
  taxaRealCentavos?: number | string | null
}

export function taxaGatewayReais(e: Entrada): number {
  if (e.taxaRealCentavos != null && e.taxaRealCentavos !== '') return Number(e.taxaRealCentavos) / 100
  const parcelas = Math.max(1, Number(e.parcelas ?? 1) || 1)
  const r2 = (n: number) => Math.round(n * 100) / 100

  if (e.gateway === 'asaas') {
    if (e.metodo === 'pix') return Math.min(e.valor, 1.99)
    if (e.metodo === 'credito' || e.metodo === 'debito') {
      const pct = parcelas > 1 ? 0.0349 : 0.0299
      return r2(e.valor * pct + 0.49)
    }
    return 0
  }
  // Pagar.me (e cobranças anteriores à coluna `gateway`).
  if (e.metodo === 'pix') return r2(e.valor * 0.0099)
  if (e.metodo === 'debito') return r2(e.valor * 0.0199)
  if (e.metodo === 'credito') return r2(e.valor * (parcelas > 1 ? 0.0499 : 0.0399))
  return 0
}
