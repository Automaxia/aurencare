import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ObjetivosEscolher() {
  await requirePsicologo()
  return (
    <div>
      <PageHeader title="Objetivos e Progresso" subtitle="Continuidade terapêutica" withCfp />
      <PatientSelector current={null} basePath="/pacientes" segment="objetivos" />
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 2px' }}>
        Selecione um paciente acima para ver e gerir os objetivos terapêuticos.
      </p>
    </div>
  )
}
