import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { sanearFalas } from '@/lib/trechoMarcado'

export const runtime = 'nodejs'

const MARKS = new Set(['insight', 'comportamento', 'avanco'])

/**
 * PUT /api/sessao/[id]/marcacoes — regrava indicadores.marcacoes de uma sessão
 * já encerrada (ex.: o psicólogo aceitou as marcações sugeridas no pós-sessão,
 * ou ajustou quais falas entram em cada destaque na revisão).
 * Body: { marcacoes: Array<{ idx, mark, who, ts, falas? }> }.
 * `falas` (índices de turno) é opcional: se um item não trouxer, preserva o
 * ajuste já salvo para o mesmo idx — assim quem regrava só as marcas (ex.: o
 * aceite de sugestões) não apaga a seleção feita na revisão.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const lista = Array.isArray(body?.marcacoes) ? body.marcacoes : null
  if (!lista) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 })

  const { rows } = await db.query(
    `SELECT indicadores->'marcacoes' AS marcacoes FROM sessoes WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id],
  )
  if (!rows.length) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  const falasSalvas = new Map<number, number[]>()
  for (const m of Array.isArray(rows[0].marcacoes) ? rows[0].marcacoes : []) {
    const f = m && Number.isInteger(m.idx) ? sanearFalas(m.falas, m.idx) : null
    if (f) falasSalvas.set(m.idx, f)
  }

  const marcacoes = lista
    .filter((m: any) => m && Number.isInteger(m.idx) && m.idx >= 0 && MARKS.has(m.mark))
    .slice(0, 500)
    .map((m: any) => {
      const falas = 'falas' in m ? sanearFalas(m.falas, m.idx) : (falasSalvas.get(m.idx) ?? null)
      return {
        idx: m.idx,
        mark: m.mark,
        who: m.who === 'psicologo' ? 'psicologo' : 'paciente',
        ts: typeof m.ts === 'string' ? m.ts.slice(0, 40) : null,
        // Só índices, sem texto: indicadores não é cifrado. O trecho sai da transcrição (AES).
        ...(falas ? { falas } : {}),
      }
    })

  const { rowCount } = await db.query(
    `UPDATE sessoes
        SET indicadores = jsonb_set(COALESCE(indicadores, '{}'::jsonb), '{marcacoes}', $3::jsonb, true)
      WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id, JSON.stringify(marcacoes)],
  )
  if (!rowCount) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, total: marcacoes.length })
}
