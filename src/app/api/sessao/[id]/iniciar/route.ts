import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { iniciarSessao } from '@/server/services/sessoes'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  try {
    await iniciarSessao(user.id, params.id)
  } catch {
    // 404 e não 403: quem não é dono não deve nem saber que a sessão existe.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
