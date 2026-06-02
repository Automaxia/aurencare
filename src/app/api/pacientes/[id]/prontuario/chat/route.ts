import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { chatProntuarioIa, SUGESTOES_INICIAIS } from '@/server/services/prontuarioIa'
import type { ChatMessage } from '@/server/lib/anthropic'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET — devolve sugestões iniciais (botões prontos pro chat).
 * POST — recebe histórico {messages: [{role, content}]} e devolve resposta.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ sugestoes: SUGESTOES_INICIAIS })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [params.id, user.id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await req.json().catch(() => ({} as any))
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
  // saneamento mínimo: limita a 16 mensagens e 4000 chars cada
  const limpas = messages.slice(-16).map((m: any): ChatMessage => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '').slice(0, 4000),
  })).filter(m => m.content.length > 0)

  if (limpas.length === 0) {
    return NextResponse.json({ error: 'mensagens_vazias' }, { status: 400 })
  }

  try {
    const r = await chatProntuarioIa({
      psicologoId: user.id,
      pacienteId: params.id,
      messages: limpas,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ resposta: r.resposta })
  } catch (err) {
    log.err('prontuario.ia.chat', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
