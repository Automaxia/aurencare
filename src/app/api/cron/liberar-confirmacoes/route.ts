import { NextResponse } from 'next/server'
import { liberarSilenciosos } from '@/server/services/confirmacaoSessao'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron: libera sessões cuja janela de confirmação expirou sem resposta.
 * Deve ser chamado a cada 5-10 minutos por um scheduler externo
 * (Vercel Cron, Render Cron, Railway Cron, etc).
 *
 * Autenticação: header `Authorization: Bearer <CRON_SECRET>` ou
 * query `?key=<CRON_SECRET>` (fallback pra schedulers que não passam header).
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
      log.warn('cron.liberar', 'chamada sem credencial')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const n = await liberarSilenciosos()
    return NextResponse.json({ ok: true, liberadas: n })
  } catch (err) {
    log.err('cron.liberar', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
