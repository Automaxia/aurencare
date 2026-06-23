'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/lib/auth'
import { definirStatusUsuario, definirRoleUsuario, type AdminResult } from '@/server/services/admin'

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
