import 'server-only'
import { db } from '@/server/db/pool'
import { encrypt, tryDecrypt } from '@/server/lib/crypto'
import { log } from '@/server/lib/log'

/**
 * Histórico de prontuários redigidos com IA assistente.
 * Texto final e mensagens do chat criptografados em repouso.
 */

export type Mensagem = { role: 'user' | 'assistant'; content: string }

export type ProntuarioIaResumo = {
  id: string
  titulo: string
  createdAt: string
  updatedAt: string
}

export type ProntuarioIaCompleto = ProntuarioIaResumo & {
  texto: string
  mensagens: Mensagem[]
}

export async function listarProntuariosIa(psicologoId: string, pacienteId: string): Promise<ProntuarioIaResumo[]> {
  // ownership: só pacientes da própria psicóloga
  const { rows } = await db.query<{ id: string; titulo: string; created_at: string; updated_at: string }>(
    `SELECT p.id, p.titulo, p.created_at, p.updated_at
       FROM prontuarios_ia p
       JOIN pacientes pa ON pa.id = p.paciente_id
      WHERE p.paciente_id = $1 AND pa.psicologo_id = $2
      ORDER BY p.updated_at DESC
      LIMIT 50`,
    [pacienteId, psicologoId],
  )
  return rows.map(r => ({
    id: r.id, titulo: r.titulo,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }))
}

export async function buscarProntuarioIa(psicologoId: string, hid: string): Promise<ProntuarioIaCompleto | null> {
  const { rows } = await db.query<{
    id: string; titulo: string; texto_enc: string; mensagens_enc: string;
    created_at: string; updated_at: string;
  }>(
    `SELECT p.id, p.titulo, p.texto_enc, p.mensagens_enc, p.created_at, p.updated_at
       FROM prontuarios_ia p
       JOIN pacientes pa ON pa.id = p.paciente_id
      WHERE p.id = $1 AND pa.psicologo_id = $2 LIMIT 1`,
    [hid, psicologoId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  const texto = tryDecrypt(r.texto_enc) ?? ''
  const mensagensJson = tryDecrypt(r.mensagens_enc) ?? '[]'
  let mensagens: Mensagem[] = []
  try {
    const parsed = JSON.parse(mensagensJson)
    if (Array.isArray(parsed)) mensagens = parsed.filter(isMensagem)
  } catch { /* mantém vazio */ }

  return {
    id: r.id, titulo: r.titulo, texto, mensagens,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export type CriarInput = {
  psicologoId: string
  pacienteId: string
  titulo: string
  texto: string
  mensagens: Mensagem[]
}

export async function criarProntuarioIa(input: CriarInput): Promise<{ id: string } | null> {
  if (input.titulo.trim().length < 2 || input.texto.trim().length < 20) return null
  // ownership check
  const { rowCount } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [input.pacienteId, input.psicologoId],
  )
  if (!rowCount) return null

  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO prontuarios_ia (paciente_id, psicologo_id, titulo, texto_enc, mensagens_enc)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.pacienteId, input.psicologoId,
        input.titulo.trim().slice(0, 160),
        encrypt(input.texto),
        encrypt(JSON.stringify(input.mensagens.slice(-50))),
      ],
    )
    log.ok('prontuario.ia.historico', `criado ${rows[0].id} paciente=${input.pacienteId}`)
    return { id: rows[0].id }
  } catch (err) {
    log.err('prontuario.ia.historico', 'falha criar', err)
    return null
  }
}

export type AtualizarInput = {
  psicologoId: string
  hid: string
  titulo?: string
  texto?: string
  mensagens?: Mensagem[]
}

export async function atualizarProntuarioIa(input: AtualizarInput): Promise<boolean> {
  const fields: string[] = []
  const values: any[] = [input.hid, input.psicologoId]
  const set = (col: string, v: any) => { fields.push(`${col} = $${values.length + 1}`); values.push(v) }
  if (input.titulo !== undefined) set('titulo', input.titulo.trim().slice(0, 160))
  if (input.texto !== undefined)  set('texto_enc', encrypt(input.texto))
  if (input.mensagens !== undefined) set('mensagens_enc', encrypt(JSON.stringify(input.mensagens.slice(-50))))
  if (fields.length === 0) return false
  fields.push('updated_at = NOW()')

  // ownership join no WHERE
  const sql = `
    UPDATE prontuarios_ia SET ${fields.join(', ')}
     WHERE id = $1
       AND paciente_id IN (SELECT id FROM pacientes WHERE psicologo_id = $2)
  `
  const r = await db.query(sql, values)
  return (r.rowCount ?? 0) > 0
}

export async function deletarProntuarioIa(psicologoId: string, hid: string): Promise<boolean> {
  const r = await db.query(
    `DELETE FROM prontuarios_ia
      WHERE id = $1
        AND paciente_id IN (SELECT id FROM pacientes WHERE psicologo_id = $2)`,
    [hid, psicologoId],
  )
  return (r.rowCount ?? 0) > 0
}

function isMensagem(x: any): x is Mensagem {
  return x && typeof x === 'object'
    && (x.role === 'user' || x.role === 'assistant')
    && typeof x.content === 'string'
}
