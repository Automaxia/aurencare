import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'

export const runtime = 'nodejs'

const MARKS = new Set(['insight', 'comportamento', 'avanco'])

/**
 * PUT /api/sessao/[id]/marcacoes — regrava indicadores.marcacoes de uma sessão
 * já encerrada (ex.: o psicólogo aceitou as marcações sugeridas no pós-sessão).
 * Body: { marcacoes: Array<{ idx, mark, who, ts }> }.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const lista = Array.isArray(body?.marcacoes) ? body.marcacoes : null
  if (!lista) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 })

  const marcacoes = lista
    .filter((m: any) => m && Number.isInteger(m.idx) && MARKS.has(m.mark))
    .slice(0, 500)
    .map((m: any) => ({
      idx: m.idx,
      mark: m.mark,
      who: m.who === 'psicologo' ? 'psicologo' : 'paciente',
      ts: typeof m.ts === 'string' ? m.ts.slice(0, 40) : null,
      // Sem texto: indicadores não é cifrado. O trecho sai da transcrição (AES).
    }))

  const { rowCount } = await db.query(
    `UPDATE sessoes
        SET indicadores = jsonb_set(COALESCE(indicadores, '{}'::jsonb), '{marcacoes}', $3::jsonb, true)
      WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id, JSON.stringify(marcacoes)],
  )
  if (!rowCount) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, total: marcacoes.length })
}
