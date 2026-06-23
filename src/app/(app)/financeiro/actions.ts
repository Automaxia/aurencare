'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { editarCobranca, removerCobranca, type EditarCobrancaPatch } from '@/server/services/financeiro'

const STATUS_OK = ['pago', 'pendente', 'reembolsado', 'falhou', 'contestado', 'isento']

export async function editarCobrancaAction(sessaoId: string, patch: EditarCobrancaPatch): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  if (patch.pagamentoStatus !== undefined && !STATUS_OK.includes(patch.pagamentoStatus)) {
    return { ok: false, error: 'Status inválido.' }
  }
  if (patch.valor !== undefined && (isNaN(patch.valor) || patch.valor < 0)) {
    return { ok: false, error: 'Valor inválido.' }
  }
  const ok = await editarCobranca(user.id, sessaoId, patch)
  if (ok) revalidatePath('/financeiro')
  return { ok, error: ok ? undefined : 'Não foi possível salvar.' }
}

export async function removerCobrancaAction(sessaoId: string): Promise<{ ok: boolean }> {
  const user = await requirePsicologo()
  const ok = await removerCobranca(user.id, sessaoId)
  if (ok) revalidatePath('/financeiro')
  return { ok }
}
