import { NextResponse } from 'next/server'
import { processarMensagemRecebida } from '@/server/services/inbox'
import { log } from '@/server/lib/log'
import { redis } from '@/server/lib/redis'

/**
 * Webhook Evolution API. §10 Fluxo 4.
 * Payload típico (messages.upsert): { event, data: { key: { remoteJid }, message: { conversation } } }
 * Outros eventos relevantes: qrcode.updated, connection.update
 */
export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const evt = body?.event as string | undefined
  log.info('evolution.webhook', `event=${evt} inst=${body?.instance}`)

  // QR code: o Evolution v2 manda 'qrcode.updated' (com ponto) ou 'QRCODE_UPDATED' (sublinhado).
  if (evt === 'qrcode.updated' || evt === 'QRCODE_UPDATED') {
    const inst = body?.instance ?? 'auren-care'
    const qrBase64 = body?.data?.qrcode?.base64 ?? body?.data?.base64 ?? null
    const qrCode   = body?.data?.qrcode?.code   ?? body?.data?.code   ?? null
    const r = await redis()
    if (r && (qrBase64 || qrCode)) {
      await r.set(`wa-qr:${inst}`, JSON.stringify({ base64: qrBase64, code: qrCode, ts: Date.now() }), { EX: 120 })
      log.info('evolution.webhook', `QR salvo em Redis para ${inst}`)
    } else {
      log.warn('evolution.webhook', 'qrcode.updated sem base64/code', body?.data)
    }
    return NextResponse.json({ ok: true, captured: 'qrcode' })
  }

  // Connection state: limpa QR ao conectar
  if (evt === 'connection.update') {
    const inst = body?.instance ?? 'auren-care'
    const state = body?.data?.state
    log.info('evolution.webhook', `connection ${inst} → ${state}`)
    if (state === 'open') {
      const r = await redis()
      if (r) await r.del(`wa-qr:${inst}`)
    }
    return NextResponse.json({ ok: true, captured: 'connection' })
  }

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
