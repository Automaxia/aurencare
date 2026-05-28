'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PERIODOS = [
  { key: 'mes',  label: 'Este mês' },
  { key: '30d',  label: 'Últimos 30 dias' },
  { key: '90d',  label: 'Últimos 90 dias' },
  { key: 'ano',  label: 'Este ano' },
] as const

const STATUSES = [
  { key: 'todos',       label: 'Todos' },
  { key: 'pago',        label: 'Pago' },
  { key: 'pendente',    label: 'Pendente' },
  { key: 'reembolsado', label: 'Reembolsado' },
  { key: 'falhou',      label: 'Falhou' },
] as const

const METODOS = [
  { key: 'todos',   label: 'Todos' },
  { key: 'pix',     label: 'PIX' },
  { key: 'credito', label: 'Crédito' },
  { key: 'debito',  label: 'Débito' },
] as const

type Counts = Record<string, number>

type Props = {
  periodo: string
  status: string
  metodo: string
  busca: string
  countsStatus: Counts
  countsMetodo: Counts
}

export function FinanceiroFilters({ periodo, status, metodo, busca, countsStatus, countsMetodo }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(busca)

  function update(next: Record<string, string>) {
    const u = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === 'todos' || (k === 'periodo' && v === 'mes')) u.delete(k)
      else u.set(k, v)
    }
    router.push(`/financeiro${u.toString() ? '?' + u.toString() : ''}`)
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="ftabs">
          {PERIODOS.map(p => (
            <button key={p.key} className={`ftab${periodo === p.key ? ' active' : ''}`} onClick={() => update({ periodo: p.key })}>
              {p.label}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); update({ busca: q }) }} style={{ marginLeft: 'auto' }}>
          <div className="search-box">
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>⌕</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar paciente…" />
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="sec-lbl-sm" style={{ marginRight: 4 }}>Status</span>
        <div className="ftabs">
          {STATUSES.map(s => (
            <button key={s.key} className={`ftab${status === s.key ? ' active' : ''}`} onClick={() => update({ status: s.key })}>
              {s.label}
              {countsStatus[s.key] > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>{countsStatus[s.key]}</span>}
            </button>
          ))}
        </div>

        <span className="sec-lbl-sm" style={{ marginLeft: 12, marginRight: 4 }}>Método</span>
        <div className="ftabs">
          {METODOS.map(m => (
            <button key={m.key} className={`ftab${metodo === m.key ? ' active' : ''}`} onClick={() => update({ metodo: m.key })}>
              {m.label}
              {countsMetodo[m.key] > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>{countsMetodo[m.key]}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
