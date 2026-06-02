import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PatientSelector } from '@/components/PatientSelector'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { listarObjetivos } from '@/server/services/objetivos'
import { tryDecrypt } from '@/server/lib/crypto'
import { formatDateBR } from '@/lib/formatters'
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

  const [objetivos, historico] = await Promise.all([
    listarObjetivos(params.id),
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

        {/* ───── Bloco 3: Marcos do processo (IA, lazy) ───── */}
        <MarcosCliente pacienteId={params.id} />
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
