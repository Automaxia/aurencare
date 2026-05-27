import 'server-only'
import { db } from '@/server/db/pool'

export type Objetivo = {
  id: string
  pacienteId: string
  titulo: string
  descricao: string | null
  status: 'ativo' | 'concluido' | 'pausado'
  progresso: number
  createdAt: string
  updatedAt: string
}

function rowToObj(r: any): Objetivo {
  return {
    id: r.id, pacienteId: r.paciente_id, titulo: r.titulo, descricao: r.descricao,
    status: r.status, progresso: r.progresso, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function listarObjetivos(pacienteId: string): Promise<Objetivo[]> {
  const { rows } = await db.query(
    `SELECT * FROM objetivos WHERE paciente_id = $1 ORDER BY status='concluido', created_at DESC`,
    [pacienteId],
  )
  return rows.map(rowToObj)
}

export async function criarObjetivo(pacienteId: string, titulo: string, descricao: string | null): Promise<Objetivo> {
  const { rows } = await db.query(
    `INSERT INTO objetivos (paciente_id, titulo, descricao) VALUES ($1, $2, $3) RETURNING *`,
    [pacienteId, titulo, descricao],
  )
  return rowToObj(rows[0])
}

export async function atualizarObjetivo(id: string, patch: Partial<Pick<Objetivo, 'titulo' | 'descricao' | 'status' | 'progresso'>>): Promise<Objetivo | null> {
  const fields: string[] = []
  const values: any[] = [id]
  if (patch.titulo !== undefined)    { fields.push(`titulo = $${values.length + 1}`); values.push(patch.titulo) }
  if (patch.descricao !== undefined) { fields.push(`descricao = $${values.length + 1}`); values.push(patch.descricao) }
  if (patch.status !== undefined)    { fields.push(`status = $${values.length + 1}`); values.push(patch.status) }
  if (patch.progresso !== undefined) { fields.push(`progresso = $${values.length + 1}`); values.push(Math.max(0, Math.min(100, patch.progresso))) }
  if (fields.length === 0) return null
  fields.push('updated_at = NOW()')
  const { rows } = await db.query(`UPDATE objetivos SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, values)
  return rows[0] ? rowToObj(rows[0]) : null
}

export async function deletarObjetivo(id: string): Promise<void> {
  await db.query('DELETE FROM objetivos WHERE id = $1', [id])
}
