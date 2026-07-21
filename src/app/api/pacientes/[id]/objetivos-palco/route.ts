import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { objetivosParaPalco } from '@/server/services/objetivos'

export const runtime = 'nodejs'

/**
 * GET /api/pacientes/[id]/objetivos-palco — objetivos ativos (compactos) do
 * paciente pro "palco compartilhado" da videochamada. Só o psicólogo dono; o
 * dado sai daqui (autenticado) e é EMPURRADO pro paciente pelo canal WebRTC —
 * a sessão pública do paciente nunca acessa este endpoint.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const objetivos = await objetivosParaPalco(user.id, params.id)
  return NextResponse.json({ objetivos })
}
