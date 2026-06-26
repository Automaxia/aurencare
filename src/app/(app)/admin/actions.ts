'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/lib/auth'
import { definirStatusUsuario, definirRoleUsuario, excluirPsicologo, type AdminResult } from '@/server/services/admin'
import { historicoLogins, type LoginEvento } from '@/server/services/usoPsicologo'

export async function suspenderUsuarioAction(alvoId: string, status: 'ativo' | 'suspenso'): Promise<AdminResult> {
  const admin = await requireRole('admin')
  const r = await definirStatusUsuario(admin.id, alvoId, status)
  if (r.ok) revalidatePath('/admin')
  return r
}

export async function definirRoleAction(alvoId: string, role: 'admin' | 'psicologo'): Promise<AdminResult> {
  const admin = await requireRole('admin')
  const r = await definirRoleUsuario(admin.id, alvoId, role)
  if (r.ok) revalidatePath('/admin')
  return r
}

export async function excluirUsuarioAction(alvoId: string, emailConfirmado: string): Promise<AdminResult> {
  const admin = await requireRole('admin')
  const r = await excluirPsicologo(admin.id, alvoId, emailConfirmado)
  if (r.ok) revalidatePath('/admin')
  return r
}

export async function historicoLoginsAction(alvoId: string): Promise<LoginEvento[]> {
  await requireRole('admin')
  return historicoLogins(alvoId)
}
