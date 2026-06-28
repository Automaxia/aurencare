import { NextResponse } from 'next/server'
import { compararModelos } from '@/server/services/temas'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Harness de validação (§12): roda a extração Clínico de N sessões de um paciente
 * pelos dois modelos (Haiku × Sonnet), SEM gravar, e devolve o comparativo —
 * decide se o Haiku segura a rubrica. Read-only (não persiste).
 *
 * Auth: mesmo CRON_SECRET dos demais crons. Params: ?paciente=<id>&limite=N.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  const url = new URL(req.url)
  if (secret) {
    const headerAuth = req.headers.get('authorization')
    const tokenHeader = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null
    if (tokenHeader !== secret && url.searchParams.get('key') !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  const paciente = url.searchParams.get('paciente')
  if (!paciente) return NextResponse.json({ error: 'paciente_obrigatorio' }, { status: 400 })
  const limite = Math.min(8, Math.max(1, Number(url.searchParams.get('limite')) || 4))

  try {
    const r = await compararModelos(paciente, limite)
    log.info('cron.temas-validar', `comparados ${r.sessoes.length} sessões de ${paciente}`)
    return NextResponse.json({ ok: true, ...r })
  } catch (err) {
    log.err('cron.temas-validar', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
