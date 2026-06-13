'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { reagendarSessao, excluirSessao } from '@/server/services/sessoes'

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

export async function excluirSessaoAction(sessaoId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  const r = await excluirSessao(user.id, sessaoId)
  if (r.ok) { revalidatePath('/agenda'); revalidatePath('/'); return { ok: true } }
  const msg = {
    nao_encontrada: 'Sessão não encontrada.',
    realizada: 'Esta sessão já aconteceu (ou tem registro clínico) e não pode ser excluída.',
    paga: 'Sessão paga: não dá pra excluir aqui. Cancele/reembolse o paciente antes.',
    cobranca: 'Há uma cobrança ativa nesta sessão. Cancele a cobrança antes de excluir.',
  }[r.motivo]
  return { ok: false, error: msg }
}
