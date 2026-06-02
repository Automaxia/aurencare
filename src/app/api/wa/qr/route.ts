import { NextResponse } from 'next/server'
import { redis } from '@/server/lib/redis'
import { env } from '@/server/lib/env'

/**
 * GET /api/wa/qr?inst=auren-care
 * Retorna o último QR capturado pelo webhook qrcode.updated.
 * Sem autenticação — uso interno do bin/wa-setup (localhost only).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const inst = url.searchParams.get('inst') ?? env.evolutionInstance ?? 'auren-care'

  const r = await redis()
  if (!r) return NextResponse.json({ error: 'redis indisponível' }, { status: 503 })

  const raw = await r.get(`wa-qr:${inst}`)
  if (!raw) return NextResponse.json({ pending: true }, { status: 404 })

  try {
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'qr corrompido' }, { status: 500 })
  }
}
