'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { revalidatePath } from 'next/cache'
import { log } from '@/server/lib/log'
import {
  atualizarChavePix, atualizarSituacaoDoPsicologo,
  type AtualizarChavePixResult, type TipoChavePix,
} from '@/server/services/onboardingPagamento'
import {
  atualizarPerfilTributario,
  type AtualizarPerfilTributarioInput, type AtualizarPerfilTributarioResult,
} from '@/server/services/perfilTributario'

/** Consulta agora a situação da subconta no Asaas. */
export async function atualizarSituacaoAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  try {
    const s = await atualizarSituacaoDoPsicologo(user.id)
    if (!s) return { ok: false, error: 'Não há conta de recebimento no Asaas para consultar.' }
    revalidatePath('/perfil/recebimentos')
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    log.err('perfil.recebimentos', 'falha ao consultar situação no Asaas', err)
    return { ok: false, error: 'Não foi possível consultar o Asaas agora. Tente em alguns minutos.' }
  }
}

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
