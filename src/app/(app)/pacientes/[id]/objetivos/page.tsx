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

  const [objetivos, historico, medicoesMap, observacoes, gasMap, notasMap] = await Promise.all([
    listarObjetivos(params.id),
    db.query<{ id: string; numero: number; data_hora: string; status: string; assinada: boolean; resumo_ia: string | null }>(
      `SELECT id, numero, data_hora, status, assinada, resumo_ia
         FROM sessoes WHERE paciente_id = $1
         AND status IN ('concluida','no_show','cancelada','confirmada','em_curso','agendada')
        ORDER BY data_hora DESC LIMIT 12`,
      [params.id],
    ).then(r => r.rows),
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

      {/* Histórico de sessões — apoio, recolhido */}
      <details className="bloco-recolhivel" style={{ marginTop: 18 }}>
        <summary>
          <span>Histórico de sessões</span>
          <span className="resumo">{historico.length} {historico.length === 1 ? 'sessão' : 'sessões'}</span>
        </summary>
        <div className="bloco-conteudo">
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
        </div>
      </details>
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
