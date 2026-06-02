import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH — atualiza status da Nota Fiscal de uma sessão.
 * Body: { status: 'emitida' | 'dispensada' | 'pendente', numero?: string }
 *
 * - 'emitida'    — grava nf_emitida_em = NOW() (apenas se ainda não tinha)
 * - 'dispensada' — limpa número e nf_emitida_em
 * - 'pendente'   — limpa tudo (volta ao default)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  const status = body?.status as string | undefined
  const numero = body?.numero ? String(body.numero).trim().slice(0, 50) : null

  if (!['emitida', 'dispensada', 'pendente'].includes(status ?? '')) {
    return NextResponse.json({ error: 'status_invalido' }, { status: 400 })
  }

  // Ownership
  const { rows: own } = await db.query(
    `SELECT 1 FROM sessoes WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id],
  )
  if (own.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  try {
    if (status === 'emitida') {
      await db.query(
        `UPDATE sessoes SET
            nf_status = 'emitida',
            nf_numero = $2,
            nf_emitida_em = COALESCE(nf_emitida_em, NOW())
          WHERE id = $1`,
        [params.id, numero],
      )
    } else if (status === 'dispensada') {
      await db.query(
        `UPDATE sessoes SET
            nf_status = 'dispensada',
            nf_numero = NULL,
            nf_emitida_em = NULL
          WHERE id = $1`,
        [params.id],
      )
    } else {
      // pendente
      await db.query(
        `UPDATE sessoes SET
            nf_status = NULL,
            nf_numero = NULL,
            nf_emitida_em = NULL
          WHERE id = $1`,
        [params.id],
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.err('sessao.nf', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
