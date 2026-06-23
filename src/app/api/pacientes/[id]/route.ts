import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'

export const dynamic = 'force-dynamic'

/** Dados mínimos do paciente (nome) — usado pela trilha de navegação. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string; nome: string }>(
    'SELECT id, nome FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1',
    [params.id, user.id],
  )
  if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(rows[0])
}
