import { NextResponse } from 'next/server'
import { manutencaoPagamentos } from '@/server/services/manutencaoPagamentos'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Gatilho HTTP da manutenção de pagamentos (estornos pendentes, PIX vencido,
 * webhooks com erro, situação das subcontas). A lógica vive em
 * `src/server/services/manutencaoPagamentos.ts` — também agendada in-process
 * (src/server/lib/cron.ts). Esta rota permite disparo manual/externo.
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
    const r = await manutencaoPagamentos()
    return NextResponse.json({ ok: true, ...r })
  } catch (err) {
    log.err('cron.pagamentos', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
