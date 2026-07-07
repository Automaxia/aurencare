import Link from 'next/link'
import { SpiralWatermark } from '@/components/brand/SpiralWatermark'
import { Sigilo } from '@/components/Sigilo'
import { FileText, CreditCard, AlertTriangle } from 'lucide-react'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import {
  proximaSessao, listarSessoesEntre, sessoesPendentesAssinatura,
} from '@/server/services/sessoes'
import { listarPacientes } from '@/server/services/pacientes'
import { gerarMemoriaClinica } from '@/server/services/memoriaClinica'
import { statusOnboarding } from '@/server/services/onboarding'
import { temPacienteDemo } from '@/server/services/pacienteDemo'
import { formatTimeBR, formatBRL } from '@/lib/formatters'
import { IntelSection } from './intel'
import { OnboardingWizard } from './OnboardingWizard'
import { OnboardingCelebration } from './OnboardingCelebration'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  agendada: 'var(--muted)',
  aguardando_metodo: 'var(--amber)',
  aguardando_pagamento: 'var(--amber)',
  confirmada: 'var(--sage)',
  em_curso: 'var(--accent)',
  concluida: 'var(--ink-soft)',
  cancelada: 'var(--rose)',
  no_show: 'var(--rose)',
}

const STATUS_LABEL_AGENDA: Record<string, { texto: string; klass?: 'now' | 'nxt' }> = {
  agendada:             { texto: 'Agendada' },
  aguardando_metodo:    { texto: 'Aguardando' },
  aguardando_pagamento: { texto: 'Aguardando' },
  confirmada:           { texto: 'Confirmada', klass: 'nxt' },
  em_curso:             { texto: '● Agora',    klass: 'now' },
  concluida:            { texto: 'Concluída' },
  cancelada:            { texto: 'Cancelada' },
  no_show:              { texto: 'Sem comparecimento' },
}

export default async function InicioPage() {
  const user = await requirePsicologo()

  const hoje = new Date()
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0)
  const fimDia    = new Date(hoje); fimDia.setHours(23, 59, 59, 999)

  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay()); inicioSemana.setHours(0, 0, 0, 0)
  const fimSemana    = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23, 59, 59, 999)
  const fimSemanaAnt = new Date(inicioSemana); fimSemanaAnt.setDate(inicioSemana.getDate() - 1); fimSemanaAnt.setHours(23, 59, 59, 999)
  const iniSemanaAnt = new Date(inicioSemana); iniSemanaAnt.setDate(inicioSemana.getDate() - 7)

  const [proxima, sessoesHoje, sessoesSemana, sessoesAnt, pendentes, pacientes, onb, agg, estagnados, demoId] = await Promise.all([
    proximaSessao(user.id),
    listarSessoesEntre(user.id, inicioDia.toISOString(), fimDia.toISOString()),
    listarSessoesEntre(user.id, inicioSemana.toISOString(), fimSemana.toISOString()),
    listarSessoesEntre(user.id, iniSemanaAnt.toISOString(), fimSemanaAnt.toISOString()),
    sessoesPendentesAssinatura(user.id),
    listarPacientes(user.id),
    statusOnboarding(user.id),
    db.query<{ assinadas_total: number; concluidas_total: number; objetivos_ativos: number; objetivos_estagnados: number; ultima_evolucao: string | null; ultima_evolucao_paciente: string | null }>(`
      SELECT
        (SELECT count(*)::int FROM sessoes WHERE psicologo_id = $1 AND assinada = TRUE) AS assinadas_total,
        (SELECT count(*)::int FROM sessoes WHERE psicologo_id = $1 AND status = 'concluida') AS concluidas_total,
        (SELECT count(*)::int FROM objetivos o JOIN pacientes p ON p.id = o.paciente_id
           WHERE p.psicologo_id = $1 AND o.status = 'ativo' AND p.status = 'ativo') AS objetivos_ativos,
        (SELECT count(*)::int FROM objetivos o JOIN pacientes p ON p.id = o.paciente_id
           WHERE p.psicologo_id = $1 AND o.status = 'ativo' AND p.status = 'ativo'
             AND o.updated_at < NOW() - INTERVAL '14 days') AS objetivos_estagnados,
        (SELECT max(data_hora) FROM sessoes WHERE psicologo_id = $1 AND assinada = TRUE) AS ultima_evolucao,
        (SELECT paciente_id FROM sessoes WHERE psicologo_id = $1 AND assinada = TRUE ORDER BY data_hora DESC LIMIT 1) AS ultima_evolucao_paciente
    `, [user.id]).then(r => r.rows[0]),
    // Pacientes com objetivo ativo sem atualização há +14 dias — pra dizer QUEM
    // está com a pendência (não só "2 objetivos sem atualização").
    db.query<{ id: string; nome: string; n: number; mais_antigo: string }>(`
      SELECT p.id, p.nome, count(*)::int AS n, min(o.updated_at) AS mais_antigo
        FROM objetivos o JOIN pacientes p ON p.id = o.paciente_id
       WHERE p.psicologo_id = $1 AND o.status = 'ativo' AND p.status = 'ativo'
         AND o.updated_at < NOW() - INTERVAL '14 days'
       GROUP BY p.id, p.nome
       ORDER BY mais_antigo ASC
    `, [user.id]).then(r => r.rows),
    temPacienteDemo(user.id),
  ])

  const ultimaEvolStr = agg.ultima_evolucao
    ? new Date(agg.ultima_evolucao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    : null

  const semanaRecebido    = sessoesSemana.filter(s => s.pagamentoStatus === 'pago').reduce((a, s) => a + s.valor, 0)
  const semanaAntRecebido = sessoesAnt   .filter(s => s.pagamentoStatus === 'pago').reduce((a, s) => a + s.valor, 0)
  const deltaPct = semanaAntRecebido > 0
    ? Math.round(((semanaRecebido - semanaAntRecebido) / semanaAntRecebido) * 100)
    : null

  const sessaoEmAndamento = sessoesHoje.find(s => s.status === 'em_curso')
  const sessoesEmAndamento = sessoesHoje.filter(s => s.status === 'em_curso').length
  const cobrancasPendentes = sessoesSemana.filter(s =>
    s.pagamentoStatus === 'pendente' && (s.status === 'aguardando_metodo' || s.status === 'aguardando_pagamento')
    && s.pacienteStatus === 'ativo',   // paciente arquivado não gera cobrança pendente
  ).length
  const pendenciasCount = pendentes.length + cobrancasPendentes + agg.objetivos_estagnados
  // Destino contextual da pílula "pendências", por prioridade: sessão pra assinar >
  // cobrança > objetivos estagnados. Sempre leva a um lugar onde dá pra resolver —
  // nunca de volta pro próprio dashboard (mesmos destinos do card "Pendências").
  // Se só um paciente tem objetivo parado, vai direto pra ele.
  const pendenciasHref = pendentes.length > 0
    ? `/sessao/${pendentes[0].id}`
    : cobrancasPendentes > 0 ? '/financeiro'
    : estagnados.length === 1 ? `/pacientes/${estagnados[0].id}/objetivos`
    : estagnados.length > 1 ? '/pacientes'
    : '/'

  // Nome do paciente da última evolução registrada (a query traz só o id).
  const ultimaEvolucaoNome = agg.ultima_evolucao_paciente
    ? pacientes.find(p => p.id === agg.ultima_evolucao_paciente)?.nome ?? null
    : null

  // Briefing pré-sessão: memória clínica determinística (sem IA) do paciente da
  // próxima sessão — o que vem sendo trabalhado, o que emergiu/recuou, objetivo
  // parado. É o preparo que justifica o Audere. Falha nunca quebra o dashboard.
  const briefing = proxima ? await gerarMemoriaClinica(proxima.pacienteId).catch(() => null) : null
  const brRecorrente = briefing
    ? (briefing.continuidade.recorrente.length > 0 ? briefing.continuidade.recorrente : briefing.temasPredominantes.slice(0, 4))
    : []
  const brEmergindo = briefing?.continuidade.emergindo ?? []
  const brRecuando = briefing?.continuidade.recuando ?? []
  const brEstagnados = briefing?.continuidade.objetivos.filter(o => o.estado === 'estagnado').map(o => o.titulo) ?? []
  const temBriefing = !!briefing && (brRecorrente.length > 0 || brEmergindo.length > 0 || brRecuando.length > 0 || brEstagnados.length > 0)

  const ativos = pacientes.filter(p => p.status === 'ativo').length

  // Previsão de receita do mês = total agendado + agora
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999)
  const sessoesMes = await listarSessoesEntre(user.id, inicioMes.toISOString(), fimMes.toISOString())
  const previsaoMes = sessoesMes
    .filter(s => s.status !== 'cancelada' && s.status !== 'no_show')
    .reduce((a, s) => a + s.valor, 0)

  return (
    <div style={{ position: 'relative' }}>
      <SpiralWatermark />

      {!onb.completo && <OnboardingWizard status={onb} nome={firstName(user.name)} demoId={demoId} />}
      <OnboardingCelebration completo={onb.completo} />

      {/* ── Saudação ── */}
      <div className="greeting">
        <div className="date">{capitalize(formatLongDate(hoje))}</div>
        <h1>{greeting()}, <em>{firstName(user.name)}</em>.</h1>
        <div className="sub">
          <Link href="/agenda" className="pip">
            <span className="pip-d" style={{ background: 'var(--sage)' }} />
            {sessoesHoje.length} {sessoesHoje.length === 1 ? 'sessão hoje' : 'sessões hoje'}
          </Link>
          {sessaoEmAndamento && (
            <Link href={`/sessao/${sessaoEmAndamento.id}`} className="pip">
              <span className="pip-d" style={{ background: 'var(--accent)' }} />
              {sessoesEmAndamento === 1 ? 'sessão em andamento' : `${sessoesEmAndamento} em andamento`}
            </Link>
          )}
          {pendenciasCount > 0 && (
            <Link href={pendenciasHref} className="pip">
              <span className="pip-d" style={{ background: 'var(--amber)' }} />
              {pendenciasCount} {pendenciasCount === 1 ? 'pendência' : 'pendências'}
            </Link>
          )}
        </div>
      </div>

      {/* ── Próxima sessão dominante ── */}
      {proxima ? (
        <>
        <Link href={`/sessao/${proxima.id}`} className="next-sess">
          <div className="next-time">{formatTimeBR(proxima.dataHora)}</div>
          <div className="next-meta">
            <div className="next-name">
              <Sigilo>{proxima.pacienteNome}</Sigilo>{' '}
              <span style={{ fontSize: 11, fontWeight: 300, color: 'var(--muted)' }}>· Sessão {proxima.numero}</span>
            </div>
            <div className="next-detail">
              {proxima.modalidade === 'online' ? 'Online' : 'Presencial'} · {proxima.duracaoMin} min · {proxima.pagamentoStatus === 'pago' ? 'pagamento confirmado' : 'pagamento ' + proxima.pagamentoStatus}
            </div>
            <div className="next-tags">
              {proxima.status === 'em_curso' && <span className="tag t-info" style={{ fontSize: 10 }}>● Em andamento agora</span>}
              {proxima.status === 'confirmada' && <span className="tag t-ok" style={{ fontSize: 10 }}>Confirmada</span>}
              {proxima.status === 'aguardando_pagamento' && <span className="tag t-warn" style={{ fontSize: 10 }}>Aguardando pagamento</span>}
              {proxima.pagamentoStatus === 'pago' && <span className="tag t-ok" style={{ fontSize: 10 }}>{(proxima.pagamentoMetodo ?? 'pago').toUpperCase()} ✓</span>}
            </div>
          </div>
          <button className="next-cta">
            {proxima.status === 'em_curso' ? 'Retomar sessão' : 'Abrir sessão'}
          </button>
        </Link>

        {/* Preparo pra esta sessão — memória clínica determinística (sem IA) */}
        {temBriefing && (
          <div className="card-warm" style={{ marginTop: 10, marginBottom: 14, padding: '14px 18px', borderRadius: 'var(--r)' }}>
            <div className="sec-lbl" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)' }}>Preparar</span> · <Sigilo>{firstName(proxima.pacienteNome)}</Sigilo>
              {briefing!.totalSessoes > 0 && (
                <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
                  {' · '}{briefing!.totalSessoes} {briefing!.totalSessoes === 1 ? 'sessão registrada' : 'sessões registradas'}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {brRecorrente.length > 0 && <BriefLine label="Vem trabalhando" itens={brRecorrente} cor="var(--accent)" />}
              {brEmergindo.length > 0 && <BriefLine label="Emergiu há pouco" itens={brEmergindo} cor="var(--sage)" />}
              {brRecuando.length > 0 && <BriefLine label="Recuando" itens={brRecuando} cor="var(--muted)" />}
              {brEstagnados.length > 0 && <BriefLine label="⚠ Objetivo sem movimento" itens={brEstagnados} cor="var(--amber)" />}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
              <Link href={`/pacientes/${proxima.pacienteId}/temas`} style={{ fontSize: 12, color: 'var(--accent)' }}>Temas →</Link>
              <Link href={`/pacientes/${proxima.pacienteId}/evolucao`} style={{ fontSize: 12, color: 'var(--accent)' }}>Evolução →</Link>
              <Link href={`/pacientes/${proxima.pacienteId}/objetivos`} style={{ fontSize: 12, color: 'var(--accent)' }}>Objetivos →</Link>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: temBriefing ? 0 : -12, marginBottom: 22 }}>
          <Link href={`/pacientes/${proxima.pacienteId}`} style={{ fontSize: 12, color: 'var(--muted)' }}>Abrir paciente →</Link>
        </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 12 }}>Nenhum atendimento futuro confirmado após hoje.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Link href="/agenda/nova" className="btn primary">+ Agendar sessão</Link>
            <Link href="/agenda" className="btn ghost">Ver agenda</Link>
          </div>
        </div>
      )}

      {/* ── Grid 2 colunas ── */}
      <div className="home-grid">
        {/* Coluna esquerda — Seu dia + Inteligência */}
        <div className="card">
          <div className="card-h">
            <span className="card-title">Seu dia</span>
            <Link className="card-act" href="/agenda/nova">+ Encaixe</Link>
          </div>
          <div>
            {sessoesHoje.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>Nada agendado pra hoje.</div>
            ) : (
              sessoesHoje.map(s => {
                const lbl = STATUS_LABEL_AGENDA[s.status] ?? { texto: s.status }
                return (
                  <Link key={s.id} href={`/sessao/${s.id}`} className="ag-row">
                    <span className="ag-time">{formatTimeBR(s.dataHora)}</span>
                    <div className="ag-bar" style={{ background: STATUS_COLOR[s.status] }} />
                    <div className="ag-inf">
                      <div className="ag-name">
                        {s.pacienteNome}{' '}
                        <span style={{ fontWeight: 300, fontSize: 11, color: 'var(--faint)' }}>· Sessão {s.numero}</span>
                      </div>
                      <div className="ag-sub">
                        <span className={`tag t-${s.modalidade === 'online' ? 'info' : 'mute'}`} style={{ fontSize: 10 }}>
                          {s.modalidade === 'online' ? 'Online' : 'Presencial'}
                        </span>
                        {s.pagamentoStatus === 'pago' && <span className="tag t-ok" style={{ fontSize: 10 }}>pago</span>}
                      </div>
                    </div>
                    <span className={`ag-st${lbl.klass ? ' ' + lbl.klass : ''}`}>{lbl.texto}</span>
                  </Link>
                )
              })
            )}
          </div>

          {/* Inteligência silenciosa */}
          <IntelSection
            espacando={pacientes.filter(p => !p.demo && p.badge?.label === 'Espaçando').map(p => ({ id: p.id, nome: p.nome }))}
            novos={pacientes.filter(p => !p.demo && p.badge?.label === 'Nova').map(p => ({ id: p.id, nome: p.nome }))}
          />
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pendências */}
          <div className="card">
            <div className="card-h"><span className="card-title">Pendências</span></div>
            <div style={{ padding: '4px 0' }}>
              {pendentes.length === 0 && cobrancasPendentes === 0 && agg.objetivos_estagnados === 0 ? (
                <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--faint)', lineHeight: 1.55 }}>
                  Tudo em dia.<br />
                  <span style={{ fontSize: 11 }}>Nenhuma ação necessária no momento.</span>
                </div>
              ) : (
                <>
                  {pendentes.slice(0, 3).map(p => (
                    <Link key={p.id} href={`/sessao/${p.id}`} className="pend-row">
                      <span className="pend-ico" style={{ display: 'inline-flex', alignItems: 'center' }}><FileText size={14} /></span>
                      <span className="pend-lbl">Registrar — <Sigilo>{p.pacienteNome}</Sigilo></span>
                      <span className="pend-act">→</span>
                    </Link>
                  ))}
                  {cobrancasPendentes > 0 && (
                    <Link href="/financeiro" className="pend-row">
                      <span className="pend-ico" style={{ display: 'inline-flex', alignItems: 'center' }}><CreditCard size={14} /></span>
                      <span className="pend-lbl">{cobrancasPendentes} {cobrancasPendentes === 1 ? 'cobrança pendente' : 'cobranças pendentes'}</span>
                      <span className="pend-act">→</span>
                    </Link>
                  )}
                  {estagnados.slice(0, 3).map(pe => (
                    <Link key={pe.id} href={`/pacientes/${pe.id}/objetivos`} className="pend-row">
                      <span className="pend-ico" style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangle size={14} /></span>
                      <span className="pend-lbl">
                        {pe.n === 1 ? 'Objetivo parado' : `${pe.n} objetivos parados`} (+14 dias) — <Sigilo>{pe.nome}</Sigilo>
                      </span>
                      <span className="pend-act">→</span>
                    </Link>
                  ))}
                  {estagnados.length > 3 && (
                    <Link href="/pacientes" className="pend-row">
                      <span className="pend-ico" style={{ display: 'inline-flex', alignItems: 'center' }}><AlertTriangle size={14} /></span>
                      <span className="pend-lbl">+{estagnados.length - 3} {estagnados.length - 3 === 1 ? 'outro paciente' : 'outros pacientes'} com objetivo parado</span>
                      <span className="pend-act">→</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Continuidade clínica — atalho pra retomar onde parou (1 paciente, nomeado) */}
          {ultimaEvolucaoNome && (
            <Link
              href={`/pacientes/${agg.ultima_evolucao_paciente}/evolucao`}
              className="card-warm"
              style={{ display: 'block', padding: '14px 18px', textDecoration: 'none', color: 'inherit', borderRadius: 'var(--r)' }}
            >
              <div className="sec-lbl" style={{ marginBottom: 6 }}>Retomar acompanhamento</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                Última evolução registrada: <Sigilo>{ultimaEvolucaoNome}</Sigilo>{ultimaEvolStr ? ` · ${ultimaEvolStr}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>
                Abrir evolução de <Sigilo>{firstName(ultimaEvolucaoNome)}</Sigilo> →
              </div>
            </Link>
          )}

          {/* Atalhos enxutos — métricas de prática vivem na Saúde da Prática */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Link href="/pacientes?filtro=ativos" className="kpi-quiet" style={{ background: 'var(--card)' }}>
              <div className="kl">Pacientes</div>
              <div className="kv">{ativos} <span style={{ fontSize: 14, fontWeight: 300, color: 'var(--muted)' }}>{ativos === 1 ? 'ativo' : 'ativos'}</span></div>
              <div className="kn">Ver lista →</div>
            </Link>
            <Link href="/saude" className="kpi-quiet" style={{ background: 'var(--card)' }}>
              <div className="kl">Saúde da prática</div>
              <div className="kv" style={{ fontSize: 18, fontWeight: 300 }}>Indicadores</div>
              <div className="kn">Ver números →</div>
            </Link>
          </div>

          {/* Previsão do mês — financeiro é suporte, fica por último */}
          <Link href="/financeiro" className="card-warm" style={{
            display: 'block', padding: '18px 20px', textDecoration: 'none', color: 'inherit',
            cursor: 'pointer', borderRadius: 'var(--r)',
          }}>
            <div className="sec-lbl" style={{ marginBottom: 6 }}>Previsão {monthName(hoje)}</div>
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 300, fontSize: 28, lineHeight: 1, marginBottom: 4, color: 'var(--ink)' }}>
              {formatBRL(previsaoMes)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              com agenda atual → ver detalhes
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Uma linha do briefing pré-sessão: rótulo + itens (temas/objetivos).
// Linguagem observacional (frequência), nunca diagnóstica — CFP 09/2024.
function BriefLine({ label, itens, cor }: { label: string; itens: string[]; cor: string }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
      <span style={{ color: cor, fontWeight: 500 }}>{label}:</span>{' '}
      {itens.slice(0, 4).join(' · ')}
    </div>
  )
}

function firstName(nome?: string | null): string {
  return nome?.split(/\s+/)[0] ?? ''
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function capitalize(s: string): string {
  return s.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}

function monthName(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long' })
}

function formatShortBRL(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return `R$ ${Math.round(v)}`
}
