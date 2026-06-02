import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerEvolucaoObservacoes } from '@/server/services/evolucao'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * Endpoint chamado pelo client após o paint da página de Evolução Registrada.
 * Faz o trabalho pesado (chamada Anthropic) fora do SSR pra não bloquear
 * a renderização inicial. Cache Redis 24h dentro do service.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ nome: string }>(
    `SELECT nome FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [params.id, user.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const obs = await lerEvolucaoObservacoes(params.id, rows[0].nome)
    return NextResponse.json(obs)
  } catch (err) {
    log.err('evolucao.observacoes', 'falha', err)
    return NextResponse.json({ temas: [], instrumentos: [] })
  }
}
