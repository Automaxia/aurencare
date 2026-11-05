/**
 * Regra da troca de plano de quem já assina (nov/2026). Puro: sem banco/rede.
 *
 *  - SUBIR de plano: vale na hora. A diferença do resto do ciclo já pago entra
 *    na próxima fatura, proporcional aos dias que faltam, no ciclo ATUAL.
 *    Ex.: Essencial→Pro mensal faltando 20 de 30 dias = (159,90−69,90)×20/30.
 *  - DESCER de plano ou trocar só o ciclo: vale na renovação. Até lá segue o
 *    plano pago — e não dá para subir, gastar a cota e descer antes de pagar.
 *  - Subir E trocar o ciclo: o plano sobe na hora; o ciclo novo, na renovação.
 *  - Escolher o plano/ciclo que já tem: desfaz uma troca agendada.
 */
import { precoCentavos, type PlanoPago, type Ciclo } from './planos'

const ORDEM: Record<PlanoPago, number> = { essencial: 1, pro: 2 }

export type TrocaPlano = {
  /** Plano/ciclo que valem a partir de agora. */
  planoAgora: PlanoPago
  cicloAgora: Ciclo
  /** Destino na renovação; `null` = nada agendado. */
  agendado: { plano: PlanoPago; ciclo: Ciclo } | null
  /** Diferença proporcional somada na próxima fatura (0 se não subiu). */
  acrescimoCentavos: number
  tipo: 'upgrade' | 'agendada' | 'sem_mudanca'
}

/** Início do ciclo vigente: `expira` menos um ciclo. */
function inicioCiclo(expira: Date, ciclo: Ciclo): Date {
  const d = new Date(expira)
  if (ciclo === 'anual') d.setFullYear(d.getFullYear() - 1)
  else d.setMonth(d.getMonth() - 1)
  return d
}

/** Fração do ciclo que ainda falta (0..1). Sem data de fim, cobra a diferença cheia. */
export function fracaoRestante(expiraEm: string | Date | null, ciclo: Ciclo, agora = new Date()): number {
  if (!expiraEm) return 1
  const fim = new Date(expiraEm)
  if (Number.isNaN(fim.getTime())) return 1
  const total = fim.getTime() - inicioCiclo(fim, ciclo).getTime()
  const resta = fim.getTime() - agora.getTime()
  return Math.min(1, Math.max(0, resta / total))
}

export function calcularTroca(p: {
  planoAtual: PlanoPago; cicloAtual: Ciclo
  planoNovo: PlanoPago; cicloNovo: Ciclo
  expiraEm: string | Date | null
  agora?: Date
}): TrocaPlano {
  const { planoAtual, cicloAtual, planoNovo, cicloNovo } = p

  if (planoNovo === planoAtual && cicloNovo === cicloAtual) {
    return { planoAgora: planoAtual, cicloAgora: cicloAtual, agendado: null, acrescimoCentavos: 0, tipo: 'sem_mudanca' }
  }

  if (ORDEM[planoNovo] > ORDEM[planoAtual]) {
    const diff = precoCentavos(planoNovo, cicloAtual) - precoCentavos(planoAtual, cicloAtual)
    const acrescimo = Math.max(0, Math.round(diff * fracaoRestante(p.expiraEm, cicloAtual, p.agora)))
    return {
      planoAgora: planoNovo, cicloAgora: cicloAtual,
      agendado: cicloNovo !== cicloAtual ? { plano: planoNovo, ciclo: cicloNovo } : null,
      acrescimoCentavos: acrescimo, tipo: 'upgrade',
    }
  }

  return {
    planoAgora: planoAtual, cicloAgora: cicloAtual,
    agendado: { plano: planoNovo, ciclo: cicloNovo }, acrescimoCentavos: 0, tipo: 'agendada',
  }
}
