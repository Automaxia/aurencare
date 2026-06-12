import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarSessoesEntre } from '@/server/services/sessoes'
import { formatTimeBR, formatDateBR } from '@/lib/formatters'
import { ViewToggle } from './view-toggle'
import { SessaoBlock } from './SessaoBlock'

export const dynamic = 'force-dynamic'

type View = 'dia' | 'semana' | 'mes'

const STATUS_COLOR: Record<string, string> = {
  agendada:             'var(--muted)',
  aguardando_metodo:    'var(--amber)',
  aguardando_pagamento: 'var(--amber)',
  confirmada:           'var(--sage)',
  em_curso:             'var(--accent)',
  concluida:            'var(--ink-soft)',
  cancelada:            'var(--rose)',
  no_show:              'var(--rose)',
}

/** Retorna background + border-left para o cal-block, baseado no status. */
function blockStyles(status: string): { background: string; borderLeft: string } {
  if (status === 'em_curso')             return { background: 'rgba(107,79,207,.08)', borderLeft: '2.5px solid var(--accent)' }
  if (status === 'confirmada')           return { background: 'var(--sage-lo)',       borderLeft: '2.5px solid var(--sage)' }
  if (status === 'aguardando_metodo' ||
      status === 'aguardando_pagamento') return { background: 'var(--amber-lo)',      borderLeft: '2.5px solid var(--amber)' }
  if (status === 'cancelada' ||
      status === 'no_show')              return { background: 'rgba(196,96,122,.07)', borderLeft: '2.5px solid var(--rose)' }
  if (status === 'concluida')            return { background: 'rgba(56,50,78,.04)',   borderLeft: '2.5px solid var(--ink-soft)' }
  return { background: 'rgba(122,117,144,.06)', borderLeft: '2.5px solid var(--muted)' }
}

function pagamentoTag(s: { pagamentoStatus: string; pagamentoMetodo: string | null; status: string }): { klass: string; texto: string } | null {
  if (s.pagamentoStatus === 'pago') {
    const klass = s.status === 'em_curso' ? 'cal-tag-purple' : 'cal-tag-green'
    return { klass, texto: `${(s.pagamentoMetodo ?? 'pago').toUpperCase()} ✓` }
  }
  if (s.pagamentoStatus === 'pendente' &&
      (s.status === 'aguardando_metodo' || s.status === 'aguardando_pagamento')) {
    return { klass: 'cal-tag-amber', texto: 'aguardando' }
  }
  if (s.status === 'cancelada' || s.status === 'no_show') {
    return { klass: 'cal-tag-rose', texto: s.status === 'no_show' ? 'sem comparecimento' : 'cancelada' }
  }
  return null
}

export default async function AgendaPage({ searchParams }: { searchParams: { view?: View; data?: string } }) {
  const user = await requirePsicologo()
  const view: View = (searchParams?.view ?? 'semana') as View
  const ancora = searchParams?.data ? new Date(searchParams.data) : new Date()

  const { inicio, fim } = rangeFor(view, ancora)
  const sessoes = await listarSessoesEntre(user.id, inicio.toISOString(), fim.toISOString())

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={`Visão ${view} · ${formatDateBR(inicio.toISOString())} → ${formatDateBR(fim.toISOString())}`}
        actions={<Link className="btn primary" href="/agenda/nova">+ Nova sessão</Link>}
      />

      <ViewToggle view={view} ancora={ancora.toISOString()} />

      {sessoes.length === 0 ? (
        <EmptyState>Sem sessões nesta janela.</EmptyState>
      ) : view === 'dia' ? (
        <DayView sessoes={sessoes} />
      ) : view === 'semana' ? (
        <WeekView inicio={inicio} sessoes={sessoes} />
      ) : (
        <MonthView inicio={inicio} sessoes={sessoes} />
      )}
    </div>
  )
}

function rangeFor(view: View, ancora: Date): { inicio: Date; fim: Date } {
  const d = new Date(ancora)
  d.setHours(0, 0, 0, 0)
  if (view === 'dia') {
    const fim = new Date(d); fim.setHours(23, 59, 59, 999)
    return { inicio: d, fim }
  }
  if (view === 'semana') {
    const dow = d.getDay()
    const inicio = new Date(d); inicio.setDate(d.getDate() - dow)
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999)
    return { inicio, fim }
  }
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { inicio, fim }
}

function DayView({ sessoes }: { sessoes: any[] }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7)
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', minHeight: 600 }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: 60, borderTop: '1px solid var(--border)', padding: '4px 10px', fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', borderLeft: '1px solid var(--border)' }}>
          {hours.map(h => (
            <div key={h} style={{ height: 60, borderTop: '1px solid var(--border)' }} />
          ))}
          {sessoes.map((s: any) => {
            const dt = new Date(s.dataHora)
            const top = (dt.getHours() - 7) * 60 + dt.getMinutes()
            const height = Math.max(36, s.duracaoMin)
            const blockS = blockStyles(s.status)
            const pTag = pagamentoTag(s)
            return (
              <SessaoBlock
                key={s.id} sessao={s} className="cal-block"
                style={{
                  position: 'absolute', left: 8, right: 8, top, minHeight: height,
                  padding: '8px 10px', ...blockS,
                }}
              >
                <div className="cal-block-name">
                  {s.pacienteNome}
                  {s.status === 'em_curso' && <span className="cal-live-badge">● ao vivo</span>}
                  {s.seriePosicao && <SerieBadge posicao={s.seriePosicao.posicao} total={s.seriePosicao.total} />}
                </div>
                <div className="cal-block-meta">
                  Sessão {s.numero} · {s.modalidade === 'online' ? 'Online' : 'Presencial'} · {s.duracaoMin}min
                </div>
                {pTag && <span className={pTag.klass}>{pTag.texto}</span>}
              </SessaoBlock>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SerieBadge({ posicao, total, compact = false }: { posicao: number; total: number; compact?: boolean }) {
  return (
    <span
      title={`Sessão ${posicao} de ${total} dessa série`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        marginLeft: 6, padding: compact ? '1px 5px' : '1px 7px',
        fontSize: compact ? 9 : 10, fontWeight: 500,
        background: 'rgba(106,78,200,.10)', color: '#391d96',
        borderRadius: 999, letterSpacing: '.02em',
        whiteSpace: 'nowrap',
      }}
    >
      ⟲ {posicao}/{total}
    </span>
  )
}

function WeekView({ inicio, sessoes }: { inicio: Date; sessoes: any[] }) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d
  })
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const hoje = new Date().toDateString()

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {dias.map((d, i) => {
          const isToday = d.toDateString() === hoje
          return (
            <div key={i} style={{
              padding: '12px 14px',
              borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
              background: isToday ? 'var(--accent-lo)' : 'transparent',
            }}>
              <div style={{ fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--faint)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: isToday ? 500 : 400 }}>{labels[i]}</div>
              <div style={{ fontSize: 15, fontWeight: isToday ? 600 : 500, color: isToday ? 'var(--accent)' : 'var(--muted)' }}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 360 }}>
        {dias.map((d, i) => (
          <div key={i} style={{
            borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
            padding: 6,
            background: d.toDateString() === hoje ? 'var(--accent-lo)' : 'transparent',
          }}>
            {sessoes
              .filter((s: any) => new Date(s.dataHora).toDateString() === d.toDateString())
              .sort((a: any, b: any) => +new Date(a.dataHora) - +new Date(b.dataHora))
              .map((s: any) => {
                const pTag = pagamentoTag(s)
                return (
                  <SessaoBlock key={s.id} sessao={s} className="cal-block" style={{ marginBottom: 4, ...blockStyles(s.status) }}>
                    <div className="cal-block-name">
                      {s.pacienteNome.split(' ')[0]}
                      {s.status === 'em_curso' && <span className="cal-live-badge">● ao vivo</span>}
                      {s.seriePosicao && <SerieBadge posicao={s.seriePosicao.posicao} total={s.seriePosicao.total} compact />}
                    </div>
                    <div className="cal-block-meta">{formatTimeBR(s.dataHora)} · {s.modalidade === 'online' ? 'Online' : 'Presencial'}</div>
                    {pTag && <span className={pTag.klass}>{pTag.texto}</span>}
                  </SessaoBlock>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthView({ inicio, sessoes }: { inicio: Date; sessoes: any[] }) {
  const dias: (Date | null)[] = []
  const offsetIni = new Date(inicio.getFullYear(), inicio.getMonth(), 1).getDay()
  const totalDias = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate()
  for (let i = 0; i < offsetIni; i++) dias.push(null)
  for (let d = 1; d <= totalDias; d++) dias.push(new Date(inicio.getFullYear(), inicio.getMonth(), d))
  const hoje = new Date().toDateString()

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((l, i) => (
          <div key={l} style={{ padding: 10, fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: 1, borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {dias.map((d, i) => {
          if (!d) return <div key={i} style={{ borderTop: '1px solid var(--border)', minHeight: 88, borderLeft: i % 7 ? '1px solid var(--border)' : undefined }} />
          const isToday = d.toDateString() === hoje
          const dssns = sessoes.filter((s: any) => new Date(s.dataHora).toDateString() === d.toDateString())
          return (
            <div key={i} style={{
              borderTop: '1px solid var(--border)',
              borderLeft: i % 7 ? '1px solid var(--border)' : undefined,
              padding: 6, minHeight: 88,
              background: isToday ? 'var(--accent-lo)' : 'transparent',
            }}>
              <div style={{ fontSize: 12, marginBottom: 4, fontWeight: isToday ? 600 : 400, color: isToday ? 'var(--accent)' : 'var(--ink-soft)' }}>{d.getDate()}</div>
              {dssns.slice(0, 3).map((s: any) => (
                <SessaoBlock key={s.id} sessao={s} className="cal-block" style={{ padding: '3px 6px', marginBottom: 2, ...blockStyles(s.status), position: 'relative' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatTimeBR(s.dataHora)} {s.pacienteNome.split(' ')[0]}
                  </div>
                  {s.seriePosicao && (
                    <span
                      title={`Série · ${s.seriePosicao.posicao}/${s.seriePosicao.total}`}
                      style={{
                        position: 'absolute', top: 3, right: 3,
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--accent)', opacity: .65,
                      }}
                    />
                  )}
                </SessaoBlock>
              ))}
              {dssns.length > 3 && <div style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 6 }}>+{dssns.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
