'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import {
  criarObjetivo, atualizarObjetivo, deletarObjetivo, registrarMedicao, deletarMedicao,
  lerEvolucaoObjetivo,
  type Objetivo, type AtualizarObjetivoPatch, type CriarObjetivoInput, type Medicao, type EvolucaoObjetivo,
} from '@/server/services/objetivos'

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

export async function criarObjetivoAction(pacienteId: string, input: CriarObjetivoInput): Promise<Objetivo | null> {
  try { await checkAccess(pacienteId) } catch { return null }
  return criarObjetivo(pacienteId, input)
}

export async function atualizarObjetivoAction(id: string, patch: AtualizarObjetivoPatch): Promise<Objetivo | null> {
  try { await ownObjective(id) } catch { return null }
  return atualizarObjetivo(id, patch)
}

export async function deletarObjetivoAction(id: string): Promise<boolean> {
  try { await ownObjective(id) } catch { return false }
  await deletarObjetivo(id)
  return true
}

export async function registrarMedicaoAction(
  objetivoId: string,
  input: { medidoEm?: string; valor: number; nota?: string | null },
): Promise<Medicao | null> {
  try { await ownObjective(objetivoId) } catch { return null }
  return registrarMedicao(objetivoId, { ...input, origem: 'psicologa' })
}

export async function deletarMedicaoAction(medicaoId: string, objetivoId: string): Promise<boolean> {
  try { await ownObjective(objetivoId) } catch { return false }
  await deletarMedicao(medicaoId, objetivoId)
  return true
}

export async function lerEvolucaoAction(objetivoId: string): Promise<EvolucaoObjetivo | null> {
  try { await ownObjective(objetivoId) } catch { return null }
  return lerEvolucaoObjetivo(objetivoId)
}
