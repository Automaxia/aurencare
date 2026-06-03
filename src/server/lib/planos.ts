import 'server-only'

/**
 * Config central dos planos (modelo freemium pago) §Pricing.
 *
 * Caps e preços vivem AQUI (não no banco) — mudar preço/limite é editar este
 * arquivo, sem migration. O banco só guarda QUAL plano cada psicólogo tem.
 *
 * Economia unitária (jun/2026): custo ~R$ 1,27/sessão-IA (transcrição R$ 0,83
 * + IA R$ 0,44, já otimizado: Haiku/Sonnet 4.6 + batching). Preços calibrados
 * para ~30%+ de margem líquida no teto de uso de cada plano.
 *
 * Anual: ~12% off (margem não suporta os 40% do mercado).
 */

export type Plano = 'free' | 'essencial' | 'pro'
export type PlanoPago = Exclude<Plano, 'free'>
export type Ciclo = 'mensal' | 'anual'

export type PlanoConfig = {
  nome: string
  /** Sessões-IA (Modo Presença) por mês. Gate bloqueia ao atingir. */
  capSessoesIa: number
  precoMensalCentavos: number
  /** Cobrado de uma vez por ano (~12% off vs 12× mensal). null no free. */
  precoAnualCentavos: number | null
  destaque?: boolean
}

export const PLANOS: Record<Plano, PlanoConfig> = {
  free: {
    nome: 'Free',
    capSessoesIa: 3,
    precoMensalCentavos: 0,
    precoAnualCentavos: null,
  },
  essencial: {
    nome: 'Essencial',
    capSessoesIa: 30,
    precoMensalCentavos: 6990,    // R$ 69,90
    precoAnualCentavos: 73800,    // R$ 738,00/ano (~R$ 61,50/mês)
  },
  pro: {
    nome: 'Pro',
    capSessoesIa: 80,
    precoMensalCentavos: 15990,   // R$ 159,90
    precoAnualCentavos: 168900,   // R$ 1.689,00/ano (~R$ 140,75/mês)
    destaque: true,
  },
}

/** Preço (centavos) cobrado por ciclo de cobrança. Lança se o plano for free. */
export function precoCentavos(plano: PlanoPago, ciclo: Ciclo): number {
  const cfg = PLANOS[plano]
  const valor = ciclo === 'anual' ? cfg.precoAnualCentavos : cfg.precoMensalCentavos
  if (valor == null) throw new Error(`plano ${plano} sem preço para ciclo ${ciclo}`)
  return valor
}

/** Cap de sessões-IA do plano. */
export function capSessoesIa(plano: Plano): number {
  return PLANOS[plano].capSessoesIa
}
