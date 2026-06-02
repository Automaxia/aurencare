'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { salvarCondicoesPaciente, type Condicoes } from '@/server/services/contexto'
import {
  atualizarPaciente, arquivarPaciente, reativarPaciente, excluirPacienteDefinitivo,
  type AtualizarPacienteInput, type AtualizarPacienteResult, type ExcluirResult,
} from '@/server/services/pacientes'
import { revalidatePath } from 'next/cache'

export async function salvarCondicoesAction(pacienteId: string, condicoes: Condicoes): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [pacienteId, user.id])
  if (rows.length === 0) return { ok: false }
  await salvarCondicoesPaciente(pacienteId, condicoes)
  revalidatePath(`/pacientes/${pacienteId}`)
  return { ok: true }
}

export async function atualizarPacienteAction(
  pacienteId: string, patch: AtualizarPacienteInput,
): Promise<AtualizarPacienteResult> {
  const user = await requirePsicologo()
  const r = await atualizarPaciente(user.id, pacienteId, patch)
  if (r.ok) {
    revalidatePath(`/pacientes/${pacienteId}`)
    revalidatePath('/pacientes')
  }
  return r
}

export async function arquivarPacienteAction(pacienteId: string): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  const ok = await arquivarPaciente(user.id, pacienteId)
  if (ok) {
    revalidatePath(`/pacientes/${pacienteId}`)
    revalidatePath('/pacientes')
  }
  return { ok }
}

export async function reativarPacienteAction(pacienteId: string): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  const ok = await reativarPaciente(user.id, pacienteId)
  if (ok) {
    revalidatePath(`/pacientes/${pacienteId}`)
    revalidatePath('/pacientes')
  }
  return { ok }
}

export async function excluirPacienteAction(pacienteId: string): Promise<ExcluirResult> {
  const user = await requirePsicologo()
  const r = await excluirPacienteDefinitivo(user.id, pacienteId)
  if (r.ok) revalidatePath('/pacientes')
  return r
}
