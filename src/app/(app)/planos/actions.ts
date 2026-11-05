'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { assinar, cancelar, faturaEmAberto, simularTroca, type SimulacaoTroca } from '@/server/services/assinatura'
import { BETA_LIBERADO, type PlanoPago, type Ciclo } from '@/server/lib/planos'

export type AssinarInput = {
  plano: PlanoPago
  ciclo: Ciclo
  /** Token do cartão tokenizado no front (Pagar.me). Asaas e modo mock: ausente. */
  cardToken?: string
}

export type AssinarResult = { ok: true; urlPagamento?: string | null } | { ok: false; error: string }

export async function assinarAction(input: AssinarInput): Promise<AssinarResult> {
  const user = await requirePsicologo()

  // Gate de beta no SERVIDOR. O form já esconde os botões quando BETA_LIBERADO,
  // mas server action é endpoint: sem esta checagem, uma chamada direta criaria
  // assinatura recorrente e cobraria o cartão durante o beta.
  if (BETA_LIBERADO) {
    return { ok: false, error: 'Assinaturas ainda não estão liberadas — o acesso é gratuito durante o beta.' }
  }

  if (input.plano !== 'essencial' && input.plano !== 'pro') {
    return { ok: false, error: 'Plano inválido.' }
  }
  if (input.ciclo !== 'mensal' && input.ciclo !== 'anual') {
    return { ok: false, error: 'Ciclo inválido.' }
  }

  const r = await assinar(user.id, input.plano, input.ciclo, input.cardToken ?? null)
  if (!r.ok) return r
  revalidatePath('/planos')
  revalidatePath('/', 'layout')
  return { ok: true, urlPagamento: r.urlPagamento ?? null }
}

/** Prévia da troca de plano (quanto entra na fatura e quando vale). `null` = fluxo de assinar. */
export async function simularTrocaAction(input: { plano: PlanoPago; ciclo: Ciclo }): Promise<SimulacaoTroca | null> {
  const user = await requirePsicologo()
  if (input.plano !== 'essencial' && input.plano !== 'pro') return null
  if (input.ciclo !== 'mensal' && input.ciclo !== 'anual') return null
  return simularTroca(user.id, input.plano, input.ciclo)
}

/** Asaas: abre a fatura que já está em aberto, sem criar outra assinatura. */
export async function pagarFaturaAction(): Promise<AssinarResult> {
  const user = await requirePsicologo()
  const url = await faturaEmAberto(user.id)
  if (!url) return { ok: false, error: 'Não há fatura em aberto. Se você acabou de pagar, recarregue a página em instantes.' }
  return { ok: true, urlPagamento: url }
}

export async function cancelarAction(): Promise<AssinarResult> {
  const user = await requirePsicologo()
  const r = await cancelar(user.id)
  if (!r.ok) return { ok: false, error: r.error ?? 'Falha ao cancelar.' }
  revalidatePath('/planos')
  revalidatePath('/', 'layout')
  return { ok: true }
}
