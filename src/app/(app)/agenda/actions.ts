'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { reagendarSessao } from '@/server/services/sessoes'

export async function reagendarSessaoAction(
  sessaoId: string,
  patch: { dataHora?: string; duracaoMin?: number; modalidade?: string },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  if (patch.duracaoMin !== undefined && (isNaN(patch.duracaoMin) || patch.duracaoMin < 10 || patch.duracaoMin > 240)) {
    return { ok: false, error: 'Duração inválida (10–240 min).' }
  }
  if (patch.dataHora !== undefined && isNaN(new Date(patch.dataHora).getTime())) {
    return { ok: false, error: 'Data/hora inválida.' }
  }
  const ok = await reagendarSessao(user.id, sessaoId, patch)
  if (ok) { revalidatePath('/agenda'); revalidatePath('/') }
  return { ok, error: ok ? undefined : 'Não foi possível salvar.' }
}
