import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { salvarNotaClinica } from '@/server/services/sessoes'

export const runtime = 'nodejs'

/**
 * Salva a nota clínica privada da sessão. Independente da assinatura do resumo
 * formal — serve pra reter/editar as anotações do psicólogo (inclusive a "nota
 * rápida" feita ao vivo) na tela de sessão concluída.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const nota = typeof body?.nota === 'string' ? body.nota : ''

  const ok = await salvarNotaClinica(user.id, params.id, nota)
  if (!ok) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
