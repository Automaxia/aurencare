import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import {
  proximaSessao, listarSessoesEntre, sessoesPendentesAssinatura,
} from '@/server/services/sessoes'
import { listarPacientes } from '@/server/services/pacientes'
import { formatTimeBR, formatDateBR } from '@/lib/formatters'
import { IntelSection } from './intel'

export const dynamic = 'force-dynamic'

export default async function InicioPage() {
  const user = await requirePsicologo()

  const hoje = new Date()
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0)
  const fimDia    = new Date(hoje); fimDia.setHours(23, 59, 59, 999)

  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay()); inicioSemana.setHours(0,0,0,0)
  const fimSemana    = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23,59,59,999)

  const [proxima, sessoesHoje, sessoesSemana, pendentes, pacientes] = await Promise.all([
    proximaSessao(user.id),
    listarSessoesEntre(user.id, inicioDia.toISOString(), fimDia.toISOString()),
    listarSessoesEntre(user.id, inicioSemana.toISOString(), fimSemana.toISOString()),
    sessoesPendentesAssinatura(user.id),
    listarPacientes(user.id),
  ])

  const cobrancasPendentes = sessoesSemana.filter(s =>
    s.pagamentoStatus === 'pendente' && (s.status === 'aguardando_metodo' || s.status === 'aguardando_pagamento'),
  )
  const valorRecebidoSemana = sessoesSemana
    .filter(s => s.pagamentoStatus === 'pago')
    .reduce((acc, s) => acc + (s.valor ?? 0), 0)

  const ativos = pacientes.filter(p => p.status === 'ativo').length
  const atencao = pacientes.filter(p => p.badge?.label === 'Atenção').length

  return (
    <div>
      <PageHeader title={greeting(user.name)} subtitle={formatDateBR(new Date().toISOString())} />

      {/* ── Nível 1 — Foco imediato ─────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        {proxima ? (
          <Link href={`/sessao/${proxima.id}`} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  Próxima sessão
                </div>
                <div style={{ fontFamily: 'var(--font-display), serif', fontSize: 52, lineHeight: 1, color: 'var(--ink)' }}>
                  {formatTimeBR(proxima.dataHora)}
                </div>
                <div style={{ marginTop: 8, color: 'var(--ink-soft)', fontSize: 14 }}>
                  {proxima.pacienteNome} · Sessão #{proxima.numero} · {proxima.duracaoMin}min
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span className={`badge ${proxima.status === 'confirmada' ? 'sage' : 'amber'}`}>
                  {proxima.status === 'confirmada' ? 'Confirmada' : labelStatus(proxima.status)}
                </span>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  {proxima.pagamentoStatus === 'pago' ? '✓ Pago' : '⏳ ' + labelPagamento(proxima.pagamentoStatus)}
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Sem próxima sessão agendada.
            <div style={{ marginTop: 8 }}>
              <Link href="/agenda/nova" className="btn primary">+ Nova sessão</Link>
            </div>
          </div>
        )}

        {sessoesHoje.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Agenda de hoje
            </div>
            <ul style={{ display: 'grid', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
              {sessoesHoje.map(s => (
                <li key={s.id}>
                  <Link href={`/sessao/${s.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)', minWidth: 56 }}>{formatTimeBR(s.dataHora)}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{s.pacienteNome}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{labelStatus(s.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Nível 2 — Continuidade ──────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              Pendências
            </div>
            <Row label="Sessões para registrar" value={pendentes.length} href="/pacientes?filtro=atencao" />
            <Row label="Cobranças pendentes" value={cobrancasPendentes.length} href="/financeiro" />
            <Row label="Pacientes em atenção" value={atencao} href="/pacientes?filtro=atencao" />
          </div>
          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              Esta semana
            </div>
            <Row label="Sessões agendadas" value={sessoesSemana.length} />
            <Row label="Recebido" value={`R$ ${valorRecebidoSemana.toFixed(0)}`} />
            <Row label="Pacientes ativos" value={ativos} href="/pacientes?filtro=ativos" />
          </div>
        </div>
      </section>

      {/* ── Nível 3 — Inteligência silenciosa ───────────────── */}
      <IntelSection
        pacientesEspacando={pacientes.filter(p => p.badge?.label === 'Espaçando').length}
        novos={pacientes.filter(p => p.badge?.label === 'Nova').length}
      />
    </div>
  )
}

function Row({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  )
  return href ? <Link href={href} style={{ display: 'block' }}>{inner}</Link> : inner
}

function greeting(nome?: string | null) {
  const h = new Date().getHours()
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const first = nome?.split(' ')[0] ?? ''
  return first ? `${saudacao}, ${first}` : saudacao
}

function labelStatus(s: string) {
  return ({
    agendada: 'Agendada', aguardando_metodo: 'Aguard. método', aguardando_pagamento: 'Aguard. pagamento',
    confirmada: 'Confirmada', em_curso: 'Em curso', concluida: 'Concluída',
    cancelada: 'Cancelada', no_show: 'Sem comparecimento',
  } as Record<string, string>)[s] ?? s
}
function labelPagamento(s: string) {
  return ({ pago: 'Pago', pendente: 'Pendente', falhou: 'Falhou', reembolsado: 'Reembolsado' } as Record<string, string>)[s] ?? s
}
