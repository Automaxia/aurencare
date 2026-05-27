import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { lerGrafo } from '@/server/services/temas'
import { db } from '@/server/db/pool'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [params.id, user.id])
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const grafo = await lerGrafo(params.id)
  return NextResponse.json(grafo)
}
