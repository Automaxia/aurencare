import { redirect } from 'next/navigation'
import { requirePsicologo } from '@/server/lib/auth'
import { firstPacienteIdFor } from '@/server/services/firstPatient'

export const dynamic = 'force-dynamic'

export default async function ObjetivosShortcut() {
  const user = await requirePsicologo()
  const pid = await firstPacienteIdFor(user.id)
  if (!pid) redirect('/pacientes?vazio=objetivos')
  redirect(`/pacientes/${pid}/objetivos`)
}
