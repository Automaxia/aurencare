'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarSessao } from '@/server/services/sessoes'

type Result = { ok: true; sessaoId: string } | { ok: false; error: string }

export async function criarSessaoAction(input: {
  pacienteId: string; dataHora: string; duracaoMin: number; modalidade: string; valor: number
}): Promise<Result> {
  const user = await requirePsicologo()
  if (!input.pacienteId) return { ok: false, error: 'Selecione um paciente.' }
  if (input.valor <= 0)  return { ok: false, error: 'Valor inválido.' }
  if (new Date(input.dataHora).getTime() < Date.now()) return { ok: false, error: 'Data/hora no passado.' }

  try {
    const s = await criarSessao({ psicologoId: user.id, ...input })
    revalidatePath('/agenda')
    revalidatePath('/')
    return { ok: true, sessaoId: s.id }
  } catch (err) {
    return { ok: false, error: 'Não foi possível agendar agora.' }
  }
}
