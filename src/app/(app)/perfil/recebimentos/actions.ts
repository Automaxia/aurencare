'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { atualizarChavePix, type AtualizarChavePixResult, type TipoChavePix } from '@/server/services/onboardingPagamento'
import {
  atualizarPerfilTributario,
  type AtualizarPerfilTributarioInput, type AtualizarPerfilTributarioResult,
} from '@/server/services/perfilTributario'

export async function atualizarChavePixAction(
  chave: { tipo: TipoChavePix; valor: string } | null,
): Promise<AtualizarChavePixResult> {
  const user = await requirePsicologo()
  return atualizarChavePix(user.id, chave)
}

export async function atualizarPerfilTributarioAction(
  input: AtualizarPerfilTributarioInput,
): Promise<AtualizarPerfilTributarioResult> {
  const user = await requirePsicologo()
  return atualizarPerfilTributario(user.id, input)
}
