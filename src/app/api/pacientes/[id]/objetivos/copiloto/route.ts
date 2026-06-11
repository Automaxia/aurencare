import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { copilotoObjetivos } from '@/server/services/copilotoObjetivos'

export const runtime = 'nodejs'

/** Copiloto de objetivos SMART. Só roda sob demanda (clique), pra controlar custo de IA. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()

  const { rows } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [params.id, user.id],
  )
  if (!rows[0]) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const sugestoes = await copilotoObjetivos(params.id)
    return NextResponse.json({ sugestoes })
  } catch {
    return NextResponse.json({ error: 'falha' }, { status: 500 })
  }
}
