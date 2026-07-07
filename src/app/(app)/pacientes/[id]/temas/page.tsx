import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerGrafo, padroesLongitudinais } from '@/server/services/temas'
import { TemasView } from './view'

export const dynamic = 'force-dynamic'

export type SessaoOpt = { id: string; numero: number; dataHora: string; assinada: boolean }

export default async function TemasPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1',
    [params.id],
  )
  const paciente = rows[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const [grafo, padroes, sessoesAssinadas, count] = await Promise.all([
    lerGrafo(params.id),
    padroesLongitudinais(params.id),
    db.query<SessaoOpt>(
      `SELECT id, numero, data_hora AS "dataHora", assinada
         FROM sessoes
        WHERE paciente_id = $1 AND assinada = TRUE
        ORDER BY data_hora DESC LIMIT 50`,
      [params.id],
    ).then(r => r.rows),
    db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`,
      [params.id],
    ).then(r => r.rows[0].n),
  ])

  return (
    <div>
      <PageHeader pilar="Conectar" title="Temas Recorrentes" subtitle="O que se conecta ao longo das sessões" withCfp />
      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${count} ${count === 1 ? 'sessão' : 'sessões'}` }}
        basePath="/pacientes"
        segment="temas"
      />
      <TemasView
        pacienteId={params.id}
        pacienteNome={paciente.nome}
        initialGrafo={grafo}
        padroes={padroes}
        sessoes={sessoesAssinadas}
      />
    </div>
  )
}
