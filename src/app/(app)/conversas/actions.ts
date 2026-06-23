'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { lerConversaWa, responderConversaWa, type MensagemWa } from '@/server/services/conversasWa'
import { revalidatePath } from 'next/cache'

export async function lerConversaAction(telefone: string): Promise<{ paciente: { id: string; nome: string } | null; mensagens: MensagemWa[] } | null> {
  const user = await requirePsicologo()
  return lerConversaWa(user.id, telefone)
}

export async function responderConversaAction(telefone: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  const r = await responderConversaWa(user.id, telefone, texto)
  if (r.ok) revalidatePath('/conversas')
  return r
}
