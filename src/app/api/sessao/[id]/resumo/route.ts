import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { editarResumoAssinado } from '@/server/services/sessoes'
import { validarTextoIA } from '@/server/lib/aiGuard'

export const runtime = 'nodejs'

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
