import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { Sparkline } from '@/components/Sparkline'
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
      <PageHeader title="Evolução Registrada" subtitle="Continuidade clínica" />

      <div className="disclaimer">
        <span style={{ fontSize: 16 }}>🧭</span>
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
  sparkHumor: number[]
  sparkRitmo: number[]
}

function ProfileCard(p: ProfileCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="pts-av" style={{ width: 46, height: 46, fontSize: 15 }}>{p.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 19, fontWeight: 300, marginBottom: 2, color: 'var(--ink-soft)' }}>{p.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {p.totalSessoes} {p.totalSessoes === 1 ? 'sessão' : 'sessões'}
            {' · '}{p.minutosMedia} min em média
            {' · desde '}{formatMesAno(p.desde)}
          </div>
        </div>
        <div className="profile-kpis">
          <div className="profile-kpi" style={{ background: 'var(--accent-lo)' }}>
            <span className="kn" style={{ color: 'var(--accent)' }}>{p.presenca}</span>
            <span className="kl">Presença</span>
          </div>
          <div className="profile-kpi" style={{ background: 'var(--sage-lo)' }}>
            <span className="kn" style={{ color: 'var(--sage)' }}>{p.abertura}</span>
            <span className="kl">Abertura</span>
          </div>
        </div>
      </div>

      <SparksRow sparkHumor={p.sparkHumor ?? []} sparkRitmo={p.sparkRitmo ?? []} />
    </div>
  )
}

function SparksRow({ sparkHumor, sparkRitmo }: { sparkHumor: number[]; sparkRitmo: number[] }) {
  if (sparkHumor.length < 2 && sparkRitmo.length < 2) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      {sparkHumor.length >= 2 ? (
        <SparkBlock
          title="Humor ao longo do tempo"
          hint={`últ.: ${formatEstadoLabel(sparkHumor[sparkHumor.length - 1])}`}
          values={sparkHumor}
          color="var(--accent)"
          showDots
        />
      ) : <div />}
      {sparkRitmo.length >= 2 ? (
        <SparkBlock
          title="Voz do paciente"
          hint={`últ.: ${sparkRitmo[sparkRitmo.length - 1]}% do tempo`}
          values={sparkRitmo}
          color="var(--sage)"
        />
      ) : <div />}
    </div>
  )
}

function SparkBlock({ title, hint, values, color, showDots }: { title: string; hint: string; values: number[]; color: string; showDots?: boolean }) {
  const t = tendencia(values)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {t.seta} {t.delta > 0 ? '+' : ''}{t.delta} · {hint}
        </span>
      </div>
      <Sparkline values={values} width={180} height={32} color={color} showDots={showDots} ariaLabel={title} />
    </div>
  )
}

/** Tendência de uma série: compara a janela recente com a anterior. */
function tendencia(valores: number[], janela = 4): { seta: string; delta: number } {
  if (valores.length < 2) return { seta: '→', delta: 0 }
  const n = valores.length
  const j = Math.min(janela, Math.max(1, Math.floor(n / 2)))
  const recente = valores.slice(-j)
  const anterior = valores.slice(0, n - j)
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const delta = avg(recente) - (anterior.length ? avg(anterior) : recente[0])
  const d = Math.round(delta * 10) / 10
  return { seta: Math.abs(d) < 0.1 ? '→' : d > 0 ? '↑' : '↓', delta: d }
}

function formatEstadoLabel(estado: number): string {
  if (estado >= 3) return 'agradável'
  if (estado >= 1) return 'levemente agradável'
  if (estado <= -3) return 'desagradável'
  if (estado <= -1) return 'levemente desagradável'
  return 'neutro'
}

function formatMesAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
