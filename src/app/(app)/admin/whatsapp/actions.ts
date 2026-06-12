'use server'

import { requireRole } from '@/server/lib/auth'
import { enviarWADiag } from '@/server/lib/evolution'

export async function enviarTesteWAAction(telefone: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole('admin')
  const tel = telefone.trim()
  if (tel.replace(/\D/g, '').length < 10) return { ok: false, erro: 'Telefone inválido (DDD + número).' }
  return enviarWADiag(tel, 'Teste de WhatsApp da Audere ✓ — se você recebeu isto, a integração está funcionando.')
}
