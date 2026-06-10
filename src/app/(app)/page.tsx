import Link from 'next/link'
import { SpiralWatermark } from '@/components/brand/SpiralWatermark'
import { requirePsicologo } from '@/server/lib/auth'
import {
  proximaSessao, listarSessoesEntre, sessoesPendentesAssinatura,
} from '@/server/services/sessoes'
import { listarPacientes } from '@/server/services/pacientes'
import { formatTimeBR, formatBRL } from '@/lib/formatters'
import { IntelSection } from './intel'

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

  const [proxima, sessoesHoje, sessoesSemana, sessoesAnt, pendentes, pacientes] = await Promise.all([
    proximaSessao(user.id),
    listarSessoesEntre(user.id, inicioDia.toISOString(), fimDia.toISOString()),
    listarSessoesEntre(user.id, inicioSemana.toISOString(), fimSemana.toISOString()),
    listarSessoesEntre(user.id, iniSemanaAnt.toISOString(), fimSemanaAnt.toISOString()),
    sessoesPendentesAssinatura(user.id),
    listarPacientes(user.id),
  ])

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
  const pendenciasCount = pendentes.length + cobrancasPendentes
  // Destino contextual da pílula "pendências": sessão pra assinar > financeiro
  const pendenciasHref = pendentes.length > 0
    ? `/sessao/${pendentes[0].id}`
    : cobrancasPendentes > 0 ? '/financeiro' : '/'

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
        <Link href={`/sessao/${proxima.id}`} className="next-sess">
          <div className="next-time">{formatTimeBR(proxima.dataHora)}</div>
          <div className="next-meta">
            <div className="next-name">
              {proxima.pacienteNome}{' '}
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
      ) : (
        <div className="card" style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 12 }}>Sem próxima sessão agendada.</div>
          <Link href="/agenda/nova" className="btn primary">+ Nova sessão</Link>
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
            pacientesEspacando={pacientes.filter(p => p.badge?.label === 'Espaçando').length}
            novos={pacientes.filter(p => p.badge?.label === 'Nova').length}
          />
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pendências */}
          <div className="card">
            <div className="card-h"><span className="card-title">Pendências</span></div>
            <div style={{ padding: '4px 0' }}>
              {pendentes.length === 0 && cobrancasPendentes === 0 ? (
                <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--faint)' }}>Tudo em dia.</div>
              ) : (
                <>
                  {pendentes.slice(0, 3).map(p => (
                    <Link key={p.id} href={`/sessao/${p.id}`} className="pend-row">
                      <span className="pend-ico">📝</span>
                      <span className="pend-lbl">Registrar — {p.pacienteNome}</span>
                      <span className="pend-act">→</span>
                    </Link>
                  ))}
                  {cobrancasPendentes > 0 && (
                    <Link href="/financeiro" className="pend-row">
                      <span className="pend-ico">💳</span>
                      <span className="pend-lbl">{cobrancasPendentes} {cobrancasPendentes === 1 ? 'cobrança pendente' : 'cobranças pendentes'}</span>
                      <span className="pend-act">→</span>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {/* KPI quieto — semana */}
          <Link href="/saude" className="kpi-quiet">
            <div className="kl">Sua prática esta semana</div>
            <div className="kv">{formatShortBRL(semanaRecebido)}</div>
            <div className={`kn${deltaPct !== null ? (deltaPct >= 0 ? ' up' : ' down') : ''}`}>
              {deltaPct !== null
                ? `${deltaPct >= 0 ? '↑' : '↓'} ${Math.abs(deltaPct)}% vs. semana anterior · ${sessoesHoje.length} ${sessoesHoje.length === 1 ? 'sessão hoje' : 'sessões hoje'}`
                : `${sessoesSemana.length} ${sessoesSemana.length === 1 ? 'sessão' : 'sessões'} esta semana`}
            </div>
          </Link>

          {/* Previsão do mês */}
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

          {/* Pacientes ativos */}
          <Link href="/pacientes?filtro=ativos" className="kpi-quiet" style={{ background: 'var(--card)' }}>
            <div className="kl">Pacientes ativos</div>
            <div className="kv">{ativos}</div>
            <div className="kn">ver lista →</div>
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
