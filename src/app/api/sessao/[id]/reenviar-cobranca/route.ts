import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { reenviarCobranca } from '@/server/services/sessoes'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  try {
    await reenviarCobranca(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'falha' }, { status: 500 })
  }
}
