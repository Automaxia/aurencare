import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { registrarAceiteTermo } from '@/server/services/salaVideo'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * Registra o aceite do Termo de Consentimento Informado pra Atendimento
 * Online pelo paciente. Endpoint público (sala usa token), grava IP+UA
 * como evidência conforme exigências CFP/LGPD.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const ua = h.get('user-agent') ?? null

  try {
    const ok = await registrarAceiteTermo(params.token, { ip, ua })
    if (!ok) return NextResponse.json({ error: 'sala_invalida' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.err('sala.aceite-termo', 'falha ao registrar', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
