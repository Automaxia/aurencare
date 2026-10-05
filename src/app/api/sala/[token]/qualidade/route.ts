import { NextResponse } from 'next/server'
import { db } from '@/server/db/pool'
import { buscarSalaPorToken } from '@/server/services/salaVideo'

export const runtime = 'nodejs'

/**
 * Recebe o resumo de qualidade da chamada (ver src/lib/qualidadeChamada.ts).
 * Público como as demais rotas da sala: o token é o gate. Aceita até 2h depois do
 * fim da sala — o último envio sai no `pagehide`, depois de encerrar.
 * Body (JSON, também via sendBeacon): { role, conexaoId, mobile, navegador, resumo }
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const sala = await buscarSalaPorToken(params.token)
  if (!sala) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 })
  const limite = new Date(sala.encerradaEm ?? sala.ativaAte).getTime() + 2 * 3600_000
  if (Date.now() > limite) return NextResponse.json({ error: 'sala encerrada' }, { status: 410 })

  const texto = await req.text().catch(() => '')
  if (texto.length > 8_000) return NextResponse.json({ error: 'payload grande demais' }, { status: 413 })
  let body: any
  try { body = JSON.parse(texto) } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }) }

  const role = body?.role
  const conexaoId = typeof body?.conexaoId === 'string' ? body.conexaoId.slice(0, 40) : ''
  if ((role !== 'psicologo' && role !== 'paciente') || !conexaoId || typeof body?.resumo !== 'object' || !body.resumo) {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }

  await db.query(
    `INSERT INTO chamadas_qualidade (sala_id, role, conexao_id, mobile, navegador, resumo)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (sala_id, role, conexao_id)
     DO UPDATE SET resumo = EXCLUDED.resumo, atualizado_em = NOW()`,
    [sala.id, role, conexaoId, typeof body.mobile === 'boolean' ? body.mobile : null,
     typeof body.navegador === 'string' ? body.navegador.slice(0, 60) : null, JSON.stringify(body.resumo)],
  )
  return NextResponse.json({ ok: true })
}
