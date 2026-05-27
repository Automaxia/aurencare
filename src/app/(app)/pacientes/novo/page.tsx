import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { NewPatientForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NovoPacientePage() {
  const user = await requirePsicologo()
  return (
    <div>
      <PageHeader
        title="Novo paciente"
        subtitle="Cadastro mínimo. Será enviado um WhatsApp com link de consentimento."
      />
      <NewPatientForm psicologoNome={user.name ?? 'sua psicóloga'} />
    </div>
  )
}
