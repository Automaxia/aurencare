import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { linhaDoTempoClinica } from '@/server/services/linhaDoTempo'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/** Linha do tempo clínica (lazy — tira a chamada de IA do `lerMarcos` do SSR). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [params.id, user.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const eventos = await linhaDoTempoClinica(params.id)
    return NextResponse.json({ eventos })
  } catch (err) {
    log.err('timeline.api', 'falha', err)
    return NextResponse.json({ eventos: [] })
  }
}
