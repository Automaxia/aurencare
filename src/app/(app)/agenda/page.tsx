import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarSessoesEntre } from '@/server/services/sessoes'
import { formatTimeBR, formatDateBR } from '@/lib/formatters'
import { ViewToggle } from './view-toggle'

export const dynamic = 'force-dynamic'

type View = 'dia' | 'semana' | 'mes'

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
  // mes
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { inicio, fim }
}

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

function StatusDot({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: STATUS_COLOR[status] ?? 'var(--muted)',
      }}
      title={status}
    />
  )
}

function DayView({ sessoes }: { sessoes: { id: string; dataHora: string; pacienteNome: string; status: string; numero: number; valor: number; duracaoMin: number }[] }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 7..22
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', minHeight: 600 }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: 60, borderTop: '1px solid var(--border)', padding: '2px 8px', fontSize: 11, color: 'var(--muted)' }}>
              {h.toString().padStart(2, '0')}h
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', borderLeft: '1px solid var(--border)' }}>
          {hours.map(h => (
            <div key={h} style={{ height: 60, borderTop: '1px solid var(--border)' }} />
          ))}
          {sessoes.map(s => {
            const dt = new Date(s.dataHora)
            const top = (dt.getHours() - 7) * 60 + dt.getMinutes()
            const height = Math.max(36, s.duracaoMin)
            return (
              <Link
                key={s.id}
                href={`/sessao/${s.id}`}
                style={{
                  position: 'absolute', left: 8, right: 8, top, height,
                  background: 'var(--accent-lo)', borderLeft: `3px solid ${STATUS_COLOR[s.status]}`,
                  borderRadius: 6, padding: '6px 10px', overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: '#391d96' }}>
                  {formatTimeBR(s.dataHora)} · {s.pacienteNome}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Sessão #{s.numero} · {s.duracaoMin}min · R$ {s.valor.toFixed(2)}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekView({ inicio, sessoes }: { inicio: Date; sessoes: any[] }) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d
  })
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {dias.map((d, i) => (
          <div key={i} style={{ padding: 10, borderRight: i < 6 ? '1px solid var(--border)' : undefined, minHeight: 360 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {labels[i]} <span style={{ color: 'var(--ink)' }}>{d.getDate()}</span>
            </div>
            {sessoes
              .filter(s => new Date(s.dataHora).toDateString() === d.toDateString())
              .map(s => (
                <Link key={s.id} href={`/sessao/${s.id}`} style={{
                  display: 'block', padding: '6px 8px', marginBottom: 4,
                  background: 'var(--accent-lo)', borderLeft: `3px solid ${STATUS_COLOR[s.status]}`,
                  borderRadius: 4, fontSize: 11,
                }}>
                  <div style={{ fontWeight: 500, color: '#391d96' }}>{formatTimeBR(s.dataHora)} · {s.pacienteNome}</div>
                  <div style={{ color: 'var(--muted)' }}><StatusDot status={s.status} /> {s.status}</div>
                </Link>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthView({ inicio, sessoes }: { inicio: Date; sessoes: any[] }) {
  const dias = []
  const offsetIni = new Date(inicio.getFullYear(), inicio.getMonth(), 1).getDay()
  const totalDias = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate()
  for (let i = 0; i < offsetIni; i++) dias.push(null)
  for (let d = 1; d <= totalDias; d++) dias.push(new Date(inicio.getFullYear(), inicio.getMonth(), d))

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(l => (
          <div key={l} style={{ padding: 8, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
        ))}
        {dias.map((d, i) => {
          if (!d) return <div key={i} style={{ borderTop: '1px solid var(--border)', minHeight: 80 }} />
          const dssns = sessoes.filter(s => new Date(s.dataHora).toDateString() === d.toDateString())
          return (
            <div key={i} style={{ borderTop: '1px solid var(--border)', borderLeft: i % 7 ? '1px solid var(--border)' : undefined, padding: 6, minHeight: 80 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{d.getDate()}</div>
              {dssns.slice(0, 3).map(s => (
                <Link key={s.id} href={`/sessao/${s.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
                  color: 'var(--ink-soft)', marginBottom: 2,
                }}>
                  <StatusDot status={s.status} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatTimeBR(s.dataHora)} {s.pacienteNome.split(' ')[0]}
                  </span>
                </Link>
              ))}
              {dssns.length > 3 && <div style={{ fontSize: 10, color: 'var(--muted)' }}>+{dssns.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
