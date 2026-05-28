import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { listarObjetivos } from '@/server/services/objetivos'
import { lerMarcos, type Marco } from '@/server/services/marcos'
import { tryDecrypt } from '@/server/lib/crypto'
import { formatDateBR } from '@/lib/formatters'
import { ObjetivosView } from './view'

export const dynamic = 'force-dynamic'

const TIPO_LABEL: Record<Marco['tipo'], string> = {
  inicio:     'início',
  insight:    'insight',
  avanco:     'avanço',
  mudanca:    'mudança',
  observacao: 'observação',
}
const TIPO_COLOR: Record<Marco['tipo'], string> = {
  inicio:     'var(--muted)',
  insight:    'var(--accent)',
  avanco:     'var(--sage)',
  mudanca:    'var(--amber)',
  observacao: 'var(--faint)',
}

export default async function ObjetivosPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const [objetivos, marcos, historico] = await Promise.all([
    listarObjetivos(params.id),
    lerMarcos(params.id),
    db.query<{ id: string; numero: number; data_hora: string; status: string; assinada: boolean; resumo_ia: string | null }>(
      `SELECT id, numero, data_hora, status, assinada, resumo_ia
         FROM sessoes WHERE paciente_id = $1
         AND status IN ('concluida','no_show','cancelada','confirmada','em_curso','agendada')
        ORDER BY data_hora DESC LIMIT 12`,
      [params.id],
    ).then(r => r.rows),
  ])

  return (
    <div>
      <PageHeader title="Objetivos e Progresso" subtitle="Continuidade terapêutica" withCfp />
      <PatientSelector
        current={{ id: paciente.id, nome: paciente.nome, meta: `${objetivos.length} ${objetivos.length === 1 ? 'objetivo' : 'objetivos'}` }}
        basePath="/pacientes"
        segment="objetivos"
      />

      {/* ───── Bloco 1: Objetivos terapêuticos ───── */}
      <section style={{ marginBottom: 24 }}>
        <div className="sec-lbl" style={{ marginBottom: 10 }}>Objetivos terapêuticos</div>
        <ObjetivosView pacienteId={params.id} initial={objetivos} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* ───── Bloco 2: Histórico de sessões ───── */}
        <section>
          <div className="sec-lbl" style={{ marginBottom: 10 }}>Histórico de sessões</div>
          {historico.length === 0 ? (
            <div className="empty">Sem sessões registradas ainda.</div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {historico.map(s => {
                const resumo = tryDecrypt(s.resumo_ia)
                const statusLabel = labelStatus(s.status)
                const statusTag = statusTagClass(s.status, s.assinada)
                return (
                  <li key={s.id}>
                    <Link href={`/sessao/${s.id}`} className="card" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, color: 'var(--ink-soft)' }}>#{s.numero}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateBR(s.data_hora)}</span>
                        </div>
                        <span className={`tag t-${statusTag}`}>{statusLabel}</span>
                      </div>
                      {resumo && (
                        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {resumo}
                        </p>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* ───── Bloco 3: Marcos do processo (IA) ───── */}
        <section>
          <div className="sec-lbl" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Marcos do processo</span>
            <span style={{ fontSize: 10, color: 'var(--faint)' }}>extraído por IA</span>
          </div>
          {marcos.length === 0 ? (
            <div className="empty">
              Marcos aparecem após pelo menos 2 sessões assinadas com resumo.
            </div>
          ) : (
            <div className="card" style={{ position: 'relative', padding: '18px 20px 18px 28px' }}>
              <div style={{ position: 'absolute', left: 14, top: 18, bottom: 18, width: 2, background: 'var(--border)' }} />
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 16 }}>
                {marcos.map((m, i) => (
                  <li key={i} style={{ position: 'relative', paddingLeft: 14 }}>
                    <span style={{
                      position: 'absolute', left: -8, top: 6,
                      width: 10, height: 10, borderRadius: '50%',
                      background: TIPO_COLOR[m.tipo], border: '2px solid var(--card)',
                      boxShadow: '0 0 0 1px var(--border)',
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>{m.titulo}</div>
                      <span style={{ fontSize: 10, color: TIPO_COLOR[m.tipo], textTransform: 'uppercase', letterSpacing: '.6px' }}>
                        {TIPO_LABEL[m.tipo]}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                      Sessão #{m.numero} · {formatDateBR(m.data)}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{m.descricao}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function labelStatus(s: string): string {
  return ({
    agendada: 'Agendada', aguardando_metodo: 'Aguard. método', aguardando_pagamento: 'Aguard. pagamento',
    confirmada: 'Confirmada', em_curso: 'Em curso', concluida: 'Concluída',
    cancelada: 'Cancelada', no_show: 'Sem comparecimento',
  } as Record<string, string>)[s] ?? s
}

function statusTagClass(s: string, assinada: boolean): 'ok' | 'warn' | 'mute' | 'alert' | 'info' {
  if (s === 'concluida' && assinada) return 'ok'
  if (s === 'concluida' && !assinada) return 'warn'
  if (s === 'em_curso')             return 'info'
  if (s === 'cancelada' || s === 'no_show') return 'alert'
  if (s === 'confirmada')           return 'ok'
  return 'mute'
}
