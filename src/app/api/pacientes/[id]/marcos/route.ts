import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerMarcos } from '@/server/services/marcos'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * Endpoint chamado pelo client após o paint da página de Objetivos.
 * Move a chamada Anthropic do SSR pra evitar bloquear renderização.
 * Cache Redis dentro do service.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [params.id, user.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const marcos = await lerMarcos(params.id)
    return NextResponse.json({ marcos })
  } catch (err) {
    log.err('marcos.api', 'falha', err)
    return NextResponse.json({ marcos: [] })
  }
}
