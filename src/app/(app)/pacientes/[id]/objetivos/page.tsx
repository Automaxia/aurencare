import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { listarObjetivos, valoresMedicoesPorObjetivo } from '@/server/services/objetivos'
import { listarGasPorPaciente } from '@/server/services/gasObjetivos'
import { listarNotasPorPaciente } from '@/server/services/notasObjetivos'
import { observacoesObjetivos } from '@/server/services/observacoesObjetivos'
import { sugestoesObjetivos } from '@/server/services/sugestoesObjetivos'
import { estadoObjetivo } from '@/lib/objetivos'
import { ObjetivosView } from './view'
import { MarcosCliente } from './MarcosCliente'

export const dynamic = 'force-dynamic'

export default async function ObjetivosPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const [objetivos, medicoesMap, observacoes, gasMap, notasMap] = await Promise.all([
    listarObjetivos(params.id),
    valoresMedicoesPorObjetivo(params.id),
    observacoesObjetivos(params.id),
    listarGasPorPaciente(params.id),
    listarNotasPorPaciente(params.id),
  ])

  const ativosCount = objetivos.filter(o => o.status === 'ativo').length
  const concluidos  = objetivos.filter(o => o.status === 'concluido').length
  const pausados    = objetivos.filter(o => o.status === 'pausado').length
  const emRisco     = objetivos.filter(o => o.status === 'ativo' && estadoObjetivo(o) === 'em_risco').length
  const sugestoes   = objetivos.length === 0 ? await sugestoesObjetivos(params.id) : []

  return (
    <div>
      <PageHeader title="Objetivos e Progresso" subtitle="Continuidade terapêutica" withCfp />
      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${objetivos.length} ${objetivos.length === 1 ? 'objetivo' : 'objetivos'}` }}
        basePath="/pacientes"
        segment="objetivos"
      />

      {/* Modelo mental: Temas → Objetivos → Evolução */}
      <nav className="obj-mental">
        <Link href={`/pacientes/${params.id}/temas`}><b>Temas</b> · o que acontece</Link>
        <span className="sep">→</span>
        <span><b>Objetivos</b> · o que queremos mudar</span>
        <span className="sep">→</span>
        <Link href={`/pacientes/${params.id}/evolucao`}><b>Evolução</b> · o que mudou</Link>
      </nav>

      {/* Resumo dos objetivos */}
      <div className="obj-resumo">
        {[
          { n: ativosCount, label: 'ativos', alerta: false },
          { n: concluidos,  label: 'concluídos', alerta: false },
          { n: pausados,    label: 'pausados', alerta: false },
          { n: emRisco,     label: 'em risco', alerta: emRisco > 0 },
        ].map(r => (
          <div key={r.label} className={`item${r.alerta ? ' alerta' : ''}`}>
            <div className="n" style={r.alerta ? { color: 'var(--rose)' } : undefined}>{r.n}</div>
            <div className="l">{r.label}</div>
          </div>
        ))}
      </div>

      {/* Objetivos — protagonista */}
      <ObjetivosView pacienteId={params.id} initial={objetivos} valoresIniciais={medicoesMap} observacoes={observacoes} sugestoes={sugestoes} gasInicial={gasMap} notasInicial={notasMap} />

      {/* Marcos do processo — a jornada terapêutica */}
      <section style={{ marginTop: 24 }}>
        <div className="sec-lbl" style={{ marginBottom: 10 }}>Marcos do processo</div>
        <MarcosCliente pacienteId={params.id} />
      </section>

    </div>
  )
}
