import { NextResponse } from 'next/server'
import { getIceServers } from '@/server/lib/turn'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Entrega os ICE servers (STUN + TURN) pro WebRTC do browser.
 *
 * Público de propósito: o paciente entra na sala anônimo (por token) e também
 * precisa de TURN. As credenciais TURN são efêmeras (expiram em TURN_TTL), então
 * expô-las aqui é seguro — é o mesmo modelo de credenciais de curta duração.
 */
export async function GET() {
  const iceServers = getIceServers()
  return NextResponse.json(
    { iceServers },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
