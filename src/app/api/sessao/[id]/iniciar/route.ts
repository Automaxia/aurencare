import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { iniciarSessao } from '@/server/services/sessoes'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  await iniciarSessao(params.id)
  return NextResponse.json({ ok: true })
}
