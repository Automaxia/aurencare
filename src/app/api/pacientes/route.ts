import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { listarPacientes } from '@/server/services/pacientes'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requirePsicologo()
  const pacientes = await listarPacientes(user.id)
  return NextResponse.json(pacientes)
}
