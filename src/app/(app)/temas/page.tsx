import { redirect } from 'next/navigation'
import { requirePsicologo } from '@/server/lib/auth'
import { firstPacienteIdFor } from '@/server/services/firstPatient'

export const dynamic = 'force-dynamic'

export default async function TemasShortcut() {
  const user = await requirePsicologo()
  const pid = await firstPacienteIdFor(user.id)
  if (!pid) redirect('/pacientes?vazio=temas')
  redirect(`/pacientes/${pid}/temas`)
}
