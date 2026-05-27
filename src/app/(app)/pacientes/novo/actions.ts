'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarPaciente } from '@/server/services/pacientes'

type Result = { ok: true; pacienteId: string } | { ok: false; error: string }

export async function criarPacienteAction(input: { nome: string; telefone: string; email: string | null }): Promise<Result> {
  const user = await requirePsicologo()

  const nome = input.nome.trim()
  const tel = input.telefone.replace(/\D/g, '')
  if (nome.length < 2) return { ok: false, error: 'Informe o nome completo.' }
  if (tel.length < 10) return { ok: false, error: 'Telefone inválido (DDD + número).' }

  try {
    const p = await criarPaciente({
      psicologoId: user.id,
      psicologoNome: user.name ?? 'sua psicóloga',
      nome, telefone: tel, email: input.email,
    })
    revalidatePath('/pacientes')
    return { ok: true, pacienteId: p.id }
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, error: 'Já existe paciente com esse telefone.' }
    return { ok: false, error: 'Não foi possível criar. Tente novamente.' }
  }
}
