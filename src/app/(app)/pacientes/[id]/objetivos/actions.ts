'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { criarObjetivo, atualizarObjetivo, deletarObjetivo, type Objetivo } from '@/server/services/objetivos'

async function checkAccess(pacienteId: string): Promise<string> {
  const user = await requirePsicologo()
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [pacienteId, user.id])
  if (rows.length === 0) throw new Error('forbidden')
  return user.id
}

async function ownObjective(objetivoId: string): Promise<void> {
  const user = await requirePsicologo()
  const { rows } = await db.query(
    `SELECT 1 FROM objetivos o JOIN pacientes p ON o.paciente_id = p.id
      WHERE o.id = $1 AND p.psicologo_id = $2`,
    [objetivoId, user.id],
  )
  if (rows.length === 0) throw new Error('forbidden')
}

export async function criarObjetivoAction(pacienteId: string, titulo: string, descricao: string | null): Promise<Objetivo | null> {
  try { await checkAccess(pacienteId) } catch { return null }
  return criarObjetivo(pacienteId, titulo, descricao)
}

export async function atualizarObjetivoAction(id: string, patch: { titulo?: string; descricao?: string | null; status?: Objetivo['status']; progresso?: number }): Promise<Objetivo | null> {
  try { await ownObjective(id) } catch { return null }
  return atualizarObjetivo(id, patch)
}

export async function deletarObjetivoAction(id: string): Promise<boolean> {
  try { await ownObjective(id) } catch { return false }
  await deletarObjetivo(id)
  return true
}
