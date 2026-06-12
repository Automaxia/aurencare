'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarPaciente, normalizarTelefone } from '@/server/services/pacientes'

type Result = { ok: true; pacienteId: string } | { ok: false; error: string }

export async function criarPacienteAction(input: { nome: string; telefone: string; email: string | null; mensagem?: string | null }): Promise<Result> {
  const user = await requirePsicologo()

  const nome = input.nome.trim()
  const tel = normalizarTelefone(input.telefone)
  const digits = tel.replace(/\D/g, '')
  const internacional = tel.startsWith('+')
  if (nome.length < 2) return { ok: false, error: 'Informe o nome completo.' }
  // BR: DDD + número (10–11 díg.). Internacional (+DDI): mínimo flexível.
  if (!internacional && digits.length < 10) return { ok: false, error: 'Telefone inválido (DDD + número). Para internacional, use + e o código do país.' }
  if (internacional && digits.length < 8) return { ok: false, error: 'Telefone internacional inválido (inclua o código do país após o +).' }

  const mensagem = input.mensagem?.trim() || null
  if (mensagem && mensagem.length > 1200) return { ok: false, error: 'Mensagem muito longa (máx. 1200 caracteres).' }

  try {
    const p = await criarPaciente({
      psicologoId: user.id,
      psicologoNome: user.name ?? 'quem vai te atender',
      nome, telefone: tel, email: input.email,
      mensagemCustom: mensagem,
    })
    revalidatePath('/pacientes')
    return { ok: true, pacienteId: p.id }
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, error: 'Já existe paciente com esse telefone.' }
    return { ok: false, error: 'Não foi possível criar. Tente novamente.' }
  }
}
