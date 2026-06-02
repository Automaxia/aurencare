import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import {
  listarProntuariosIa, criarProntuarioIa, type Mensagem,
} from '@/server/services/historicoProntuarioIa'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET — lista resumos dos prontuários IA salvos do paciente.
 * POST — cria um novo (body: titulo, texto, mensagens).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const lista = await listarProntuariosIa(user.id, params.id)
  return NextResponse.json({ prontuarios: lista })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  // ownership check
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [params.id, user.id])
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await req.json().catch(() => ({} as any))
  const titulo = String(body?.titulo ?? '').slice(0, 160)
  const texto  = String(body?.texto ?? '')
  const mensagens: Mensagem[] = Array.isArray(body?.mensagens)
    ? body.mensagens.slice(-50).map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? '').slice(0, 4000),
      })).filter((m: Mensagem) => m.content.length > 0)
    : []

  if (titulo.trim().length < 2 || texto.trim().length < 20) {
    return NextResponse.json({ error: 'campos_insuficientes' }, { status: 400 })
  }

  try {
    const r = await criarProntuarioIa({
      psicologoId: user.id, pacienteId: params.id,
      titulo, texto, mensagens,
    })
    if (!r) return NextResponse.json({ error: 'falha' }, { status: 500 })
    return NextResponse.json({ ok: true, id: r.id })
  } catch (err) {
    log.err('prontuario.ia.historico.post', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
