import { NextResponse } from 'next/server'
import { env, integrationStatus } from '@/server/lib/env'
import { log } from '@/server/lib/log'

/**
 * GET /api/transcribe/token
 * Gera um token efêmero (10 min) pra cliente conectar direto na
 * AssemblyAI Universal-Streaming v3 via WebSocket sem expor a master key.
 *
 * Auth: protegido pelo middleware (sessão NextAuth obrigatória).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  if (!integrationStatus.assembly) {
    return NextResponse.json({ demo: true, token: null }, { status: 200 })
  }

  try {
    const res = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
      headers: { Authorization: env.assemblyKey! },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      log.err('assemblyai.token', `${res.status} ${body}`)
      return NextResponse.json({ error: 'token indisponível' }, { status: 502 })
    }
    const json = await res.json() as { token: string; expires_in_seconds: number }
    return NextResponse.json({
      token: json.token,
      expiresIn: json.expires_in_seconds,
    })
  } catch (err) {
    log.err('assemblyai.token', 'fetch falhou', err)
    return NextResponse.json({ error: 'token indisponível' }, { status: 502 })
  }
}
