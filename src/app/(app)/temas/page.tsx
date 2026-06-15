import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TemasEscolher() {
  await requirePsicologo()
  return (
    <div>
      <PageHeader title="Temas Recorrentes" subtitle="Mapa de correlações" withCfp />
      <PatientSelector current={null} basePath="/pacientes" segment="temas" />
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px' }}>
        Selecione um paciente acima para explorar o mapa de temas das sessões.
      </p>
    </div>
  )
}
