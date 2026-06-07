import 'server-only'
import bcrypt from 'bcrypt'
import { db } from '@/server/db/pool'

export type PerfilPsicologo = {
  id: string
  nome: string
  crp: string
  email: string
  telefone: string | null
  valorSessao: number | null
  /** Detalhe técnico — gerenciado pelo Audere, não exposto na UI. */
  waInstancia: string | null
  waConectado: boolean
  pagarmeRecipientId: string | null
  createdAt: string
}

function rowToPerfil(r: any): PerfilPsicologo {
  return {
    id: r.id,
    nome: r.nome,
    crp: r.crp,
    email: r.email,
    telefone: r.telefone,
    valorSessao: r.valor_sessao !== null ? parseFloat(r.valor_sessao) : null,
    waInstancia: r.wa_instancia,
    waConectado: r.wa_conectado,
    pagarmeRecipientId: r.pagarme_recipient_id,
    createdAt: r.created_at,
  }
}

export async function obterPerfil(psicologoId: string): Promise<PerfilPsicologo | null> {
  const { rows } = await db.query(
    `SELECT id, nome, crp, email, telefone, valor_sessao, wa_instancia, wa_conectado, pagarme_recipient_id, created_at
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  return rows[0] ? rowToPerfil(rows[0]) : null
}

export type PerfilPatch = {
  nome?: string
  crp?: string
  email?: string
  telefone?: string | null
  valorSessao?: number | null
  /** Detalhe técnico — gerenciado nos bastidores. Não vem da UI da psicóloga. */
  waInstancia?: string | null
  /** Se fornecido, troca a senha. Verificação de senha antiga deve acontecer ANTES. */
  novaSenha?: string
}

export async function atualizarPerfil(psicologoId: string, patch: PerfilPatch): Promise<PerfilPsicologo> {
  const sets: string[] = []
  const params: any[] = [psicologoId]
  const add = (col: string, val: any) => { sets.push(`${col} = $${params.length + 1}`); params.push(val) }

  if (patch.nome !== undefined)        add('nome', patch.nome.trim())
  if (patch.crp !== undefined)         add('crp', patch.crp.trim())
  if (patch.email !== undefined)       add('email', patch.email.toLowerCase().trim())
  if (patch.telefone !== undefined)    add('telefone', patch.telefone?.replace(/\D/g, '') || null)
  if (patch.valorSessao !== undefined) add('valor_sessao', patch.valorSessao)
  if (patch.waInstancia !== undefined) add('wa_instancia', patch.waInstancia)
  if (patch.novaSenha !== undefined && patch.novaSenha.length > 0) {
    const hash = await bcrypt.hash(patch.novaSenha, 10)
    add('senha_hash', hash)
  }

  if (sets.length === 0) {
    const p = await obterPerfil(psicologoId)
    if (!p) throw new Error('psicologo_nao_encontrado')
    return p
  }

  const { rows } = await db.query(
    `UPDATE psicologos SET ${sets.join(', ')} WHERE id = $1
     RETURNING id, nome, crp, email, telefone, valor_sessao, wa_instancia, wa_conectado, pagarme_recipient_id, created_at`,
    params,
  )
  return rowToPerfil(rows[0])
}

/** Verifica a senha atual (pra exigir antes de troca de senha ou email). */
export async function verificarSenha(psicologoId: string, senha: string): Promise<boolean> {
  const { rows } = await db.query<{ senha_hash: string }>(
    `SELECT senha_hash FROM psicologos WHERE id = $1`, [psicologoId],
  )
  if (!rows[0]) return false
  return bcrypt.compare(senha, rows[0].senha_hash)
}

/** Verifica se email já está em uso por outra psicóloga. */
export async function emailEmUso(email: string, excetoId?: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM psicologos WHERE email = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [email.toLowerCase().trim(), excetoId ?? null],
  )
  return rows.length > 0
}
