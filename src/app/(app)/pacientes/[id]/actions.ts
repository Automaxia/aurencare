'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { salvarCondicoesPaciente, type Condicoes } from '@/server/services/contexto'
import { revalidatePath } from 'next/cache'

export async function salvarCondicoesAction(pacienteId: string, condicoes: Condicoes): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [pacienteId, user.id])
  if (rows.length === 0) return { ok: false }
  await salvarCondicoesPaciente(pacienteId, condicoes)
  revalidatePath(`/pacientes/${pacienteId}`)
  return { ok: true }
}
