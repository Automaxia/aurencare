'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const FILTROS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'ativos',    label: 'Ativos' },
  { key: 'novos',     label: 'Novos' },
  { key: 'espacando', label: 'Espaçando' },
  { key: 'atencao',   label: 'Atenção' },
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
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      {FILTROS.map(f => (
        <button
          key={f.key}
          onClick={() => update({ filtro: f.key })}
          className="btn"
          style={{
            background: active === f.key ? 'var(--accent-lo)' : undefined,
            color: active === f.key ? '#391d96' : undefined,
            borderColor: active === f.key ? 'transparent' : undefined,
          }}
        >
          {f.label}
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--muted)' }}>{counts[f.key]}</span>
        </button>
      ))}
      <form
        onSubmit={e => { e.preventDefault(); update({ busca: q }) }}
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'white', fontSize: 13, width: 240,
          }}
        />
      </form>
    </div>
  )
}
