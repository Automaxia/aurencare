'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarPaciente, normalizarTelefone } from '@/server/services/pacientes'
import { apenasDigitos, validarCpf } from '@/lib/documento'
import { validarTelefone } from '@/lib/telefone'

type Result = { ok: true; pacienteId: string } | { ok: false; error: string }

export async function criarPacienteAction(input: { nome: string; telefone: string; email: string | null; cpf?: string | null; mensagem?: string | null }): Promise<Result> {
  const user = await requirePsicologo()

  const nome = input.nome.trim()
  const tel = normalizarTelefone(input.telefone)
  if (nome.length < 2) return { ok: false, error: 'Informe o nome completo.' }
  const erroTel = validarTelefone(tel)
  if (erroTel) return { ok: false, error: erroTel }

  // CPF é opcional aqui, mas se vier tem que ser válido: um CPF errado só se
  // revelaria quando o paciente responde PIX e a Pagar.me reprova a charge.
  const cpf = apenasDigitos(input.cpf)
  if (cpf && !validarCpf(cpf)) return { ok: false, error: 'CPF inválido — confira os dígitos.' }

  const mensagem = input.mensagem?.trim() || null
  if (mensagem && mensagem.length > 1200) return { ok: false, error: 'Mensagem muito longa (máx. 1200 caracteres).' }

  try {
    const p = await criarPaciente({
      psicologoId: user.id,
      psicologoNome: user.name ?? 'quem vai te atender',
      nome, telefone: tel, email: input.email, cpf,
      mensagemCustom: mensagem,
    })
    revalidatePath('/pacientes')
    return { ok: true, pacienteId: p.id }
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, error: 'Já existe paciente com esse telefone.' }
    return { ok: false, error: 'Não foi possível criar. Tente novamente.' }
  }
}
