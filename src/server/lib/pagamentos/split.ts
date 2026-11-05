/**
 * Cálculo neutro da taxa administrativa no split. A fonte do percentual
 * continua sendo `planos.ts` (`taxaAdmSessaoCentavos`, RN-01).
 *
 * Regra Audere (RF-PG-23): a plataforma fica com EXATAMENTE 2,5% do valor
 * BRUTO; o psicólogo recebe o resto e absorve a tarifa do gateway.
 *
 * - Pagar.me: o split é sobre o bruto → fatias `flat` que somam o valor
 *   (`montarSplitSessao` em pagarme.ts).
 * - Asaas: o split é sobre o LÍQUIDO (valor − tarifa). Para os 2,5% do bruto
 *   ficarem na raiz, o psicólogo recebe `líquido − taxaAdm` em valor fixo
 *   (D-01, validado no spike: R$ 10 → raiz R$ 0,25, psicólogo R$ 8,76).
 */
import { taxaAdmSessaoCentavos } from '../planos'

export function taxaAdmCentavos(valorCentavos: number): number {
  return taxaAdmSessaoCentavos(valorCentavos)
}

/**
 * Fatia do psicólogo num split sobre o líquido. `null` quando não sobra nada
 * para ele (valor baixo demais) — a cobrança deve sair sem split.
 */
export function splitSobreLiquido(valorCentavos: number, liquidoCentavos: number): { taxaAdmCentavos: number; psicologoCentavos: number } | null {
  if (!Number.isFinite(valorCentavos) || !Number.isFinite(liquidoCentavos)) return null
  const taxa = taxaAdmCentavos(valorCentavos)
  const psicologo = Math.round(liquidoCentavos) - taxa
  if (psicologo <= 0) return null
  return { taxaAdmCentavos: taxa, psicologoCentavos: psicologo }
}

/** Reais (API do Asaas) ↔ centavos (banco/serviços), sem erro de ponto flutuante. */
export const paraCentavos = (reais: number | string | null | undefined): number =>
  Math.round(Number(reais ?? 0) * 100)
export const paraReais = (centavos: number): number => Math.round(centavos) / 100
