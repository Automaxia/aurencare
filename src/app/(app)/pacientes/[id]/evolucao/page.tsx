import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerEvolucaoDados } from '@/server/services/evolucao'
import { EvolucaoChat } from './chat'

export const dynamic = 'force-dynamic'

export default async function EvolucaoPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const dados = await lerEvolucaoDados(params.id, paciente.nome)

  return (
    <div>
      <PageHeader title="Evolução Registrada" subtitle="Continuidade clínica" />

      {/* Disclaimer destacado */}
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

      <div className="orient-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Perfil + KPIs */}
          <ProfileCard
            avatar={dados.perfil.avatar}
            nome={dados.perfil.nome}
            totalSessoes={dados.perfil.totalSessoes}
            minutosMedia={dados.perfil.minutosMedia}
            desde={dados.perfil.desde}
            presenca={dados.perfil.presenca}
            abertura={dados.perfil.abertura}
          />

          {/* Histórico de temas recorrentes */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-h" style={{ padding: '14px 18px' }}>
              <span className="card-title">Histórico de temas recorrentes</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {dados.temas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Sem temas extraídos ainda. Assine algumas sessões para começar.
                </div>
              ) : (
                dados.temas.map((t, i) => (
                  <div key={i} className={`tema-card ${t.positivo ? 'positivo' : 'neutro'}`}>
                    <div className="tema-card-h">{t.titulo}</div>
                    <div className="tema-card-b">{t.descricao}</div>
                    {t.trend && <div className="tema-card-trend">→ {t.trend}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instrumentos a considerar */}
          {dados.instrumentos.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-h" style={{ padding: '14px 18px' }}>
                <span className="card-title">Instrumentos a considerar</span>
                <span style={{ fontSize: 11, color: 'var(--faint)' }}>baseado no histórico</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dados.instrumentos.map((i, idx) => {
                  const klass = i.id === 'PHQ-9' ? 'phq9' : i.id === 'GAD-7' ? 'gad7' : 'phq9'
                  return (
                    <div key={idx} className={`instr-card ${klass}`}>
                      <div className="instr-name">{i.id}</div>
                      <div className="instr-body">{i.justificativa}</div>
                    </div>
                  )
                })}
                <div style={{
                  fontSize: 11, color: 'var(--faint)', lineHeight: 1.55,
                  padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--rsm)',
                }}>
                  A aplicação de qualquer instrumento é decisão exclusiva do psicólogo responsável.
                </div>
              </div>
            </div>
          )}
        </div>

        <EvolucaoChat pacienteId={params.id} pacienteNome={paciente.nome} totalSessoes={dados.perfil.totalSessoes} />
      </div>
    </div>
  )
}

function ProfileCard(p: { avatar: string; nome: string; totalSessoes: number; minutosMedia: number; desde: string; presenca: number; abertura: number }) {
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
    </div>
  )
}

function formatMesAno(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
