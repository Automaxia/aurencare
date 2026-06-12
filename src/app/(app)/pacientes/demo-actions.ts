'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarPacienteDemo, removerPacienteDemo } from '@/server/services/pacienteDemo'

export async function criarPacienteDemoAction(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requirePsicologo()
    const id = await criarPacienteDemo(user.id)
    revalidatePath('/pacientes')
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha ao criar demonstração.' }
  }
}

export async function removerPacienteDemoAction(): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  await removerPacienteDemo(user.id)
  revalidatePath('/pacientes')
  return { ok: true }
}
