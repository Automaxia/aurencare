'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const FILTROS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'hoje',        label: 'Sessão hoje' },
  { key: 'atencao',     label: 'Atenção' },
  { key: 'novos',       label: 'Novos' },
  { key: 'arquivados',  label: 'Arquivados' },
] as const

const ORDENACOES = [
  { key: 'proxima', label: 'Próxima sessão' },
  { key: 'nome',    label: 'Nome A–Z' },
  { key: 'recente', label: 'Mais recente' },
] as const

export type FilterKey = typeof FILTROS[number]['key']
export type OrdenacaoKey = typeof ORDENACOES[number]['key']
export type VisualizacaoKey = 'grid' | 'lista'

type Counts = Record<FilterKey, number>

type Props = {
  active: string
  counts: Counts
  busca: string
  ordenacao: OrdenacaoKey
  visualizacao: VisualizacaoKey
}

export function PacientesFilter({ active, counts, busca, ordenacao, visualizacao }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(busca)

  function update(next: { filtro?: string; busca?: string; ord?: string; vis?: string }) {
    const u = new URLSearchParams(params?.toString() ?? '')
    if (next.filtro !== undefined) u.set('filtro', next.filtro)
    if (next.busca !== undefined)  next.busca ? u.set('busca', next.busca) : u.delete('busca')
    if (next.ord !== undefined)    next.ord === 'proxima' ? u.delete('ord') : u.set('ord', next.ord)
    if (next.vis !== undefined)    next.vis === 'grid'    ? u.delete('vis') : u.set('vis', next.vis)
    router.push(`/pacientes${u.toString() ? '?' + u.toString() : ''}`)
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      {/* Linha 1: filtros principais + busca */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

      {/* Linha 2: ordenação + visualização */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="sec-lbl-sm" style={{ marginRight: 4 }}>Ordenar por</span>
        <div className="ftabs">
          {ORDENACOES.map(o => (
            <button
              key={o.key}
              onClick={() => update({ ord: o.key })}
              className={`ftab${ordenacao === o.key ? ' active' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <ViewBtn
            ativo={visualizacao === 'grid'}
            onClick={() => update({ vis: 'grid' })}
            title="Visualização em cards"
            icon="▦"
            label="Cards"
          />
          <ViewBtn
            ativo={visualizacao === 'lista'}
            onClick={() => update({ vis: 'lista' })}
            title="Visualização em lista"
            icon="≡"
            label="Lista"
          />
        </div>
      </div>
    </div>
  )
}

function ViewBtn({ ativo, onClick, title, icon, label }: { ativo: boolean; onClick: () => void; title: string; icon: string; label: string }) {
  return (
    <button
      onClick={onClick} title={title} type="button"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', border: 'none', cursor: 'pointer',
        background: ativo ? 'rgba(106,78,200,.10)' : 'transparent',
        color: ativo ? '#391d96' : 'var(--muted)',
        fontWeight: ativo ? 500 : 400, fontFamily: 'inherit', fontSize: 12,
        transition: 'all .15s var(--ease)',
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span> {label}
    </button>
  )
}
