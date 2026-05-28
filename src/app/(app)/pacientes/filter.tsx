'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const FILTROS = [
  { key: 'todos',   label: 'Todos' },
  { key: 'hoje',    label: 'Sessão hoje' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'novos',   label: 'Novos' },
] as const

type Counts = Record<typeof FILTROS[number]['key'], number>

export function PacientesFilter({ active, counts, busca }: { active: string; counts: Counts; busca: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(busca)

  function update(next: { filtro?: string; busca?: string }) {
    const u = new URLSearchParams(params?.toString() ?? '')
    if (next.filtro !== undefined) u.set('filtro', next.filtro)
    if (next.busca !== undefined)  next.busca ? u.set('busca', next.busca) : u.delete('busca')
    router.push(`/pacientes?${u.toString()}`)
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="ftabs">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => update({ filtro: f.key })}
            className={`ftab${active === f.key ? ' active' : ''}`}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>{counts[f.key]}</span>
            )}
          </button>
        ))}
      </div>
      <form
        onSubmit={e => { e.preventDefault(); update({ busca: q }) }}
        style={{ marginLeft: 'auto' }}
      >
        <div className="search-box">
          <span style={{ fontSize: 13, color: 'var(--faint)' }}>⌕</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar paciente…"
          />
        </div>
      </form>
    </div>
  )
}
