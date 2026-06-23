'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { atualizarPerfil, verificarSenha, emailEmUso, type PerfilPatch } from '@/server/services/psicologo'

export type SalvarInput = {
  nome: string
  crp: string
  email: string
  telefone: string
  valorSessao: number | null
  genero: 'f' | 'm' | null
  novaSenha: string
  confirmarNovaSenha: string
  senhaAtual: string   // exigida quando muda senha OU email
}

export type SalvarResult =
  | { ok: true }
  | { ok: false; error: string; campo?: keyof SalvarInput }

export async function salvarPerfilAction(input: SalvarInput): Promise<SalvarResult> {
  const user = await requirePsicologo()

  const nome = input.nome.trim()
  const crp = input.crp.trim()
  const email = input.email.toLowerCase().trim()
  const telefone = input.telefone?.replace(/\D/g, '') || ''
  const valor = input.valorSessao
  const novaSenha = input.novaSenha
  const confirmar = input.confirmarNovaSenha
  const senhaAtual = input.senhaAtual

  if (nome.length < 2)  return { ok: false, error: 'Informe seu nome completo.', campo: 'nome' }
  if (crp.length < 3)   return { ok: false, error: 'CRP inválido.', campo: 'crp' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Email inválido.', campo: 'email' }
  if (telefone && (telefone.length < 10 || telefone.length > 13)) {
    return { ok: false, error: 'Telefone inválido (DDD + número).', campo: 'telefone' }
  }
  if (valor !== null && valor < 0) return { ok: false, error: 'Valor não pode ser negativo.', campo: 'valorSessao' }

  const trocandoSenha = novaSenha.length > 0
  const trocandoEmail = email !== (user.email ?? '').toLowerCase()
  const exigeSenhaAtual = trocandoSenha || trocandoEmail

  if (trocandoSenha) {
    if (novaSenha.length < 8) return { ok: false, error: 'A nova senha precisa de pelo menos 8 caracteres.', campo: 'novaSenha' }
    if (novaSenha !== confirmar) return { ok: false, error: 'As senhas não coincidem.', campo: 'confirmarNovaSenha' }
  }

  if (exigeSenhaAtual) {
    if (!senhaAtual) return { ok: false, error: 'Digite sua senha atual para confirmar a alteração.', campo: 'senhaAtual' }
    const ok = await verificarSenha(user.id, senhaAtual)
    if (!ok) return { ok: false, error: 'Senha atual incorreta.', campo: 'senhaAtual' }
  }

  if (trocandoEmail) {
    const dup = await emailEmUso(email, user.id)
    if (dup) return { ok: false, error: 'Este email já está em uso.', campo: 'email' }
  }

  const patch: PerfilPatch = {
    nome, crp, email,
    telefone: telefone || null,
    valorSessao: valor,
    genero: input.genero === 'f' || input.genero === 'm' ? input.genero : null,
  }
  if (trocandoSenha) patch.novaSenha = novaSenha

  try {
    await atualizarPerfil(user.id, patch)
    revalidatePath('/perfil')
    return { ok: true }
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, error: 'Conflito de dados (CRP ou email já em uso).' }
    return { ok: false, error: 'Falha ao salvar. Tente novamente.' }
  }
}
