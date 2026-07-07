import { redirect, notFound } from 'next/navigation'
import { Compass } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { EvolucaoSparks } from './EvolucaoSparks'
import type { SparkPonto } from '@/server/services/evolucao'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerEvolucaoEstatisticas } from '@/server/services/evolucao'
import { resumoEvolucao } from '@/server/services/resumoEvolucao'
import { mudancasEPadroes } from '@/server/services/mudancasEPadroes'
import { EvolucaoChat } from './chat'
import { ObservacoesCliente } from './Observacoes'
import { LinhaDoTempo } from './LinhaDoTempo'
import { MudancasPadroes } from './MudancasPadroes'

export const dynamic = 'force-dynamic'

export default async function EvolucaoPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const [dados, resumo] = await Promise.all([
    lerEvolucaoEstatisticas(params.id, paciente.nome),
    resumoEvolucao(params.id),
  ])
  const mp = await mudancasEPadroes(params.id, dados.perfil)

  return (
    <div>
      <PageHeader pilar="Evoluir" title="Evolução Registrada" subtitle="Como o processo caminha ao longo do tempo" />

      <div className="disclaimer">
        <Compass size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#7a5520', marginBottom: 2 }}>
            Apoio à continuidade clínica
          </div>
          <div style={{ fontSize: 11, color: '#9a7030', lineHeight: 1.55 }}>
            Registros e observações de continuidade baseados no histórico das sessões.
            A interpretação e decisão clínica pertencem exclusivamente ao psicólogo responsável.
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#9a7030', whiteSpace: 'nowrap' }}>CFP 09/2024</div>
      </div>

      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${dados.perfil.totalSessoes} ${dados.perfil.totalSessoes === 1 ? 'sessão assinada' : 'sessões assinadas'}` }}
        basePath="/pacientes"
        segment="evolucao"
      />

      {/* Resumo da Evolução — síntese determinística (Fase 1) */}
      <section className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>
            Resumo da evolução
          </span>
          {!resumo.suficiente && <span style={{ fontSize: 11, color: 'var(--amber)' }}>dados ainda em formação</span>}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
          {resumo.frases.map((f, i) => <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0' }}>{f}</p>)}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10 }}>
          Observação a partir do histórico — não diagnóstico · CFP 09/2024
        </div>
      </section>

      <MudancasPadroes dados={mp} />

      <div className="orient-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ProfileCard
            avatar={dados.perfil.avatar}
            nome={dados.perfil.nome}
            totalSessoes={dados.perfil.totalSessoes}
            minutosMedia={dados.perfil.minutosMedia}
            desde={dados.perfil.desde}
            presenca={dados.perfil.presenca}
            abertura={dados.perfil.abertura}
            sparkHumor={dados.perfil.sparkHumor}
            sparkRitmo={dados.perfil.sparkRitmo}
          />

          <LinhaDoTempo pacienteId={params.id} />

          <ObservacoesCliente pacienteId={params.id} />
        </div>

        <EvolucaoChat pacienteId={params.id} pacienteNome={paciente.nome} totalSessoes={dados.perfil.totalSessoes} />
      </div>
    </div>
  )
}

type ProfileCardProps = {
  avatar: string
  nome: string
  totalSessoes: number
  minutosMedia: number
  desde: string
  presenca: number
  abertura: number
  sparkHumor: SparkPonto[]
  sparkRitmo: SparkPonto[]
}

function ProfileCard(p: ProfileCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="pts-av" style={{ width: 46, height: 46, fontSize: 15 }}>{p.avatar}</div>
        <div style={{ flex: 1 }}>
          <div className="sigilo" style={{ fontFamily: 'var(--f-display)', fontSize: 19, fontWeight: 300, marginBottom: 2, color: 'var(--ink-soft)' }}>{p.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {p.totalSessoes} {p.totalSessoes === 1 ? 'sessão' : 'sessões'}
            {' · '}{p.minutosMedia} min em média
            {' · desde '}{formatMesAno(p.desde)}
          </div>
        </div>
        <div className="profile-kpis">
          <div
            className="profile-kpi" style={{ background: 'var(--accent-lo)', cursor: 'help' }}
            title="Presença — % de comparecimento: sessões realizadas entre as agendadas que já passaram."
          >
            <span className="kn" style={{ color: 'var(--accent)' }}>{p.presenca}<span style={{ fontSize: '.6em', opacity: .7 }}>%</span></span>
            <span className="kl">Presença</span>
          </div>
          <div
            className="profile-kpi" style={{ background: 'var(--sage-lo)', cursor: 'help' }}
            title="Abertura — índice 0–100 da média do humor relatado nas sessões (quanto mais alto, mais agradável)."
          >
            <span className="kn" style={{ color: 'var(--sage)' }}>{p.abertura}<span style={{ fontSize: '.6em', opacity: .7 }}>/100</span></span>
            <span className="kl">Abertura</span>
          </div>
        </div>
      </div>

      <EvolucaoSparks humor={p.sparkHumor ?? []} ritmo={p.sparkRitmo ?? []} />
    </div>
  )
}

function formatMesAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
