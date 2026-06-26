import { NextResponse } from 'next/server'
import { perguntarMetodoPendentes } from '@/server/lib/cron'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Gatilho HTTP do Fluxo 2 das séries. A lógica vive em `perguntarMetodoPendentes`
 * (src/server/lib/cron.ts) — também agendada in-process a cada 30min. Esta rota
 * permite disparo manual/externo.
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>` ou query `?key=<CRON_SECRET>`.
 * Sem CRON_SECRET configurado, aceita qualquer chamada (modo dev).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const headerAuth = req.headers.get('authorization')
    const tokenHeader = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null
    const tokenQuery = url.searchParams.get('key')
    if (tokenHeader !== secret && tokenQuery !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const r = await perguntarMetodoPendentes()
    return NextResponse.json({ ok: true, ...r })
  } catch (err) {
    log.err('cron.perguntar', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
