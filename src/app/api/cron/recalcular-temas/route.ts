import { NextResponse } from 'next/server'
import { recalcularGrafosTodos } from '@/server/services/temas'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Manutenção one-off (pós-deploy): reextrai via IA o grafo de temas dos
 * pacientes cujo grafo foi gerado pelo antigo fallback heurístico (contagem de
 * tokens). Purga nós de ruído ("estava", "menos"…) e reconstrói com a extração
 * semântica. Idempotente — pode rodar mais de uma vez.
 *
 * Auth: mesmo padrão dos demais crons — header `Authorization: Bearer
 * <CRON_SECRET>` ou query `?key=<CRON_SECRET>`. Sem CRON_SECRET, aceita
 * qualquer chamada (modo dev). POST porque a operação muta dados.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const headerAuth = req.headers.get('authorization')
    const tokenHeader = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null
    const tokenQuery = url.searchParams.get('key')
    if (tokenHeader !== secret && tokenQuery !== secret) {
      log.warn('cron.recalcular-temas', 'chamada sem credencial')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const sp = new URL(req.url).searchParams
    const modo = sp.get('modo') === 'amplo' ? 'amplo' : 'clinico'
    const soComObjetivos = sp.get('objetivos') === '1'
    // Incremental por padrão: só reextrai sessão cujo snapshot ficou inválido
    // (prompt/abordagem ou conceitualização mudou). `?forcar=1` reextrai tudo.
    const forcar = sp.get('forcar') === '1'
    const r = await recalcularGrafosTodos(modo, soComObjetivos, { forcar })
    log.info('cron.recalcular-temas', `${r.pacientes} paciente(s) [modo=${modo}${soComObjetivos ? ', só c/ objetivos' : ''}${forcar ? ', FORÇADO' : ''}] — ${r.reextraidas} sessão(ões) reextraída(s), ${r.reaproveitadas} reaproveitada(s)`)
    return NextResponse.json({ ok: true, modo, soComObjetivos, forcar, ...r })
  } catch (err) {
    log.err('cron.recalcular-temas', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
