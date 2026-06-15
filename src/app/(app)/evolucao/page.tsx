import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'

export const dynamic = 'force-dynamic'

export default async function EvolucaoEscolher() {
  await requirePsicologo()
  return (
    <div>
      <PageHeader title="Evolução Registrada" subtitle="Continuidade clínica" />
      <PatientSelector current={null} basePath="/pacientes" segment="evolucao" />
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px' }}>
        Selecione um paciente acima para acompanhar a evolução ao longo das sessões.
      </p>
    </div>
  )
}
