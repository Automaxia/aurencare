import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { editarResumoAssinado, buscarSessao } from '@/server/services/sessoes'
import { validarTextoIA } from '@/server/lib/aiGuard'
import { iaIndisponivel } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

/**
 * Lê o registro já salvo no banco: o assinado (resumo_ia) ou, antes da
 * assinatura, o rascunho automático (resumo_curto). Serve de "retry" no
 * pós-sessão quando o POST de encerrar deu timeout (nginx 60s) mas o servidor
 * terminou de gerar e salvou o rascunho mesmo assim.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao || sessao.psicologoId !== user.id) {
    return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  }
  const resumo = sessao.resumoIa || sessao.resumoCurto
  const disponivel = !!resumo && !iaIndisponivel(resumo)
  return NextResponse.json({ resumo: disponivel ? resumo : null, disponivel })
}

/**
 * Retifica o laudo de uma sessão já assinada. Re-passa pelo guard (diagnóstico/
 * categórico), preserva a versão anterior no histórico e NÃO redispara WhatsApp.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const resumo = String(body?.resumo ?? '').trim()

  if (resumo.length === 0) return NextResponse.json({ error: 'resumo_vazio' }, { status: 400 })
  if (!validarTextoIA(resumo)) return NextResponse.json({ error: 'termos_proibidos' }, { status: 400 })

  const ok = await editarResumoAssinado(user.id, params.id, resumo)
  if (!ok) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
