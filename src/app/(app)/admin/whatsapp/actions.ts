'use server'

import { requireRole } from '@/server/lib/auth'
import { enviarWADiag, configurarWebhookEvolution } from '@/server/lib/evolution'
import { lembrete15min } from '@/server/lib/cron'

export async function configurarWebhookAction(): Promise<{ ok: boolean; url: string; erro?: string }> {
  await requireRole('admin')
  const r = await configurarWebhookEvolution()
  return { ok: r.ok, url: r.url, erro: r.erro }
}

export async function rodarLembrete15Action(): Promise<{ ok: boolean; count?: number; erro?: string }> {
  await requireRole('admin')
  try {
    const n = await lembrete15min()
    return { ok: true, count: n }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

export async function enviarTesteWAAction(telefone: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole('admin')
  const tel = telefone.trim()
  if (tel.replace(/\D/g, '').length < 10) return { ok: false, erro: 'Telefone inválido (DDD + número).' }
  return enviarWADiag(tel, 'Teste de WhatsApp da Audere ✓ — se você recebeu isto, a integração está funcionando.')
}
