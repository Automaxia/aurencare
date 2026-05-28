import { NextResponse } from 'next/server'
import { publish, type SignalRole, type SignalMessage } from '@/server/lib/signaling'
import { buscarSalaPorToken } from '@/server/services/salaVideo'

export const runtime = 'nodejs'

/**
 * Peer publica mensagem WebRTC pra os outros peers da sala.
 * Body: { role: 'psicologo'|'paciente', message: SignalMessage }
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const sala = await buscarSalaPorToken(params.token)
  if (!sala) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 })
  if (sala.encerradaEm || new Date(sala.ativaAte) < new Date()) {
    return NextResponse.json({ error: 'sala encerrada' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({} as any))
  const role = body?.role as SignalRole | undefined
  const message = body?.message as SignalMessage | undefined

  if ((role !== 'psicologo' && role !== 'paciente') || !message?.type) {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }
  message.ts = Date.now()
  message.from = role
  publish(params.token, role, message)
  return NextResponse.json({ ok: true })
}
