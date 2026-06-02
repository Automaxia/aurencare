import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import {
  buscarProntuarioIa, atualizarProntuarioIa, deletarProntuarioIa,
  type Mensagem,
} from '@/server/services/historicoProntuarioIa'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET — devolve prontuário IA salvo (titulo + texto + mensagens descriptografados).
 * PATCH — atualiza titulo/texto/mensagens.
 * DELETE — remove.
 */
export async function GET(_req: Request, { params }: { params: { id: string; hid: string } }) {
  const user = await requirePsicologo()
  const p = await buscarProntuarioIa(user.id, params.hid)
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ prontuario: p })
}

export async function PATCH(req: Request, { params }: { params: { id: string; hid: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  let mensagens: Mensagem[] | undefined
  if (Array.isArray(body?.mensagens)) {
    mensagens = body.mensagens.slice(-50).map((m: any): Mensagem => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 4000),
    })).filter((m: Mensagem) => m.content.length > 0)
  }

  try {
    const ok = await atualizarProntuarioIa({
      psicologoId: user.id,
      hid: params.hid,
      titulo: typeof body?.titulo === 'string' ? body.titulo : undefined,
      texto: typeof body?.texto === 'string' ? body.texto : undefined,
      mensagens,
    })
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.err('prontuario.ia.historico.patch', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; hid: string } }) {
  const user = await requirePsicologo()
  const ok = await deletarProntuarioIa(user.id, params.hid)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
