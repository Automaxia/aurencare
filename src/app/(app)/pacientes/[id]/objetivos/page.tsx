import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { listarObjetivos } from '@/server/services/objetivos'
import { ObjetivosView } from './view'

export const dynamic = 'force-dynamic'

export default async function ObjetivosPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const objetivos = await listarObjetivos(params.id)
  return (
    <div>
      <PageHeader title="Objetivos e Progresso" subtitle="Continuidade terapêutica" withCfp />
      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${objetivos.length} ${objetivos.length === 1 ? 'objetivo' : 'objetivos'}` }}
        basePath="/pacientes"
        segment="objetivos"
      />
      <ObjetivosView pacienteId={params.id} initial={objetivos} />
    </div>
  )
}
