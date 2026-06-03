'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { assinar, cancelar } from '@/server/services/assinatura'
import type { PlanoPago, Ciclo } from '@/server/lib/planos'

export type AssinarInput = {
  plano: PlanoPago
  ciclo: Ciclo
  /** Token do cartão tokenizado no front (Pagar.me). Em modo mock, ignorado. */
  cardToken?: string
}

export type AssinarResult = { ok: true } | { ok: false; error: string }

export async function assinarAction(input: AssinarInput): Promise<AssinarResult> {
  const user = await requirePsicologo()

  if (input.plano !== 'essencial' && input.plano !== 'pro') {
    return { ok: false, error: 'Plano inválido.' }
  }
  if (input.ciclo !== 'mensal' && input.ciclo !== 'anual') {
    return { ok: false, error: 'Ciclo inválido.' }
  }

  const r = await assinar(user.id, input.plano, input.ciclo, input.cardToken ?? 'mock_card_token')
  if (!r.ok) return r
  revalidatePath('/planos')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cancelarAction(): Promise<AssinarResult> {
  const user = await requirePsicologo()
  const r = await cancelar(user.id)
  if (!r.ok) return { ok: false, error: r.error ?? 'Falha ao cancelar.' }
  revalidatePath('/planos')
  revalidatePath('/', 'layout')
  return { ok: true }
}
