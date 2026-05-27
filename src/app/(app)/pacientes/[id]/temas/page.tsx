import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerGrafo } from '@/server/services/temas'
import { TemasView } from './view'

export const dynamic = 'force-dynamic'

export default async function TemasPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1',
    [params.id],
  )
  const paciente = rows[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  // Conta sessões para meta do pt-selector
  const { rows: count } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`, [params.id],
  )

  const grafo = await lerGrafo(params.id)
  return (
    <div>
      <PageHeader title="Temas Recorrentes" subtitle="Mapa de correlações" withCfp />
      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${count[0].n} ${count[0].n === 1 ? 'sessão' : 'sessões'}` }}
        basePath="/pacientes"
        segment="temas"
      />
      <TemasView pacienteId={params.id} initialGrafo={grafo} />
    </div>
  )
}
