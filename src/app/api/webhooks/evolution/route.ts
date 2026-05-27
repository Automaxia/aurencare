import { NextResponse } from 'next/server'
import { processarMensagemRecebida } from '@/server/services/inbox'
import { log } from '@/server/lib/log'

/**
 * Webhook Evolution API. §10 Fluxo 4.
 * Payload típico (messages.upsert): { event, data: { key: { remoteJid }, message: { conversation } } }
 */
export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const evt = body?.event as string | undefined
  if (evt && evt !== 'messages.upsert') {
    return NextResponse.json({ ok: true, ignored: evt })
  }

  const data = body?.data
  const jid: string | undefined = data?.key?.remoteJid
  const texto: string | undefined =
    data?.message?.conversation ??
    data?.message?.extendedTextMessage?.text ??
    data?.message?.imageMessage?.caption ??
    undefined

  if (!jid || !texto) {
    log.warn('evolution.webhook', 'payload sem jid ou texto', { jid, hasText: !!texto })
    return NextResponse.json({ ok: true })
  }

  const telefone = jid.split('@')[0]
  try {
    await processarMensagemRecebida({ telefone, texto })
  } catch (err) {
    log.err('evolution.webhook', 'falha ao processar', err)
  }
  return NextResponse.json({ ok: true })
}
