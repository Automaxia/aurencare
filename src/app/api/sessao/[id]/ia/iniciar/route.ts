import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { gateIniciarRegistroIa } from '@/server/services/sessoes'

export const runtime = 'nodejs'

/**
 * Gate de cota: chamado ao iniciar o REGISTRO no Modo Presença.
 * Conta 1 sessão-IA do mês (idempotente) e bloqueia (403) se o plano estourou.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  const r = await gateIniciarRegistroIa(params.id)
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, motivo: r.motivo, cap: r.cap, usadas: r.usadas, plano: r.plano },
      { status: 403 },
    )
  }
  return NextResponse.json({ ok: true })
}
