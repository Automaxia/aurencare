'use client'

import { useState } from 'react'
import type { NotaProgresso } from '@/server/services/notasObjetivos'
import { criarNotaAction, removerNotaAction } from './actions'

/**
 * Marcos de progresso da Meta — anotações livres datadas. Disponível em qualquer
 * método (SMART ou Simples). Texto livre + data; a Audere não interpreta.
 */
export function MarcosProgresso({ objetivoId, notas, onChange }: {
  objetivoId: string
  notas: NotaProgresso[]
  onChange: (notas: NotaProgresso[]) => void
}) {
  const [texto, setTexto] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)

  async function adicionar() {
    if (texto.trim().length < 2 || salvando) return
    setSalvando(true)
    const n = await criarNotaAction(objetivoId, { texto: texto.trim(), marcoEm: data })
    setSalvando(false)
    if (!n) return
    // Insere mantendo ordem por data desc
    onChange([n, ...notas].sort((a, b) => b.marcoEm.localeCompare(a.marcoEm) || b.createdAt.localeCompare(a.createdAt)))
    setTexto('')
  }

  async function remover(id: string) {
    if (!confirm('Remover este marco de progresso?')) return
    await removerNotaAction(objetivoId, id)
    onChange(notas.filter(n => n.id !== id))
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Marcos de progresso
      </div>

      {/* Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8, alignItems: 'end', marginBottom: notas.length ? 12 : 0 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Data</span>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Anotação</span>
          <input
            value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') adicionar() }}
            placeholder="Ex: relatou primeira semana sem ataques fora de casa"
            style={inp}
          />
        </label>
        <button type="button" className="btn primary" onClick={adicionar} disabled={salvando || texto.trim().length < 2} style={{ height: 36 }}>
          {salvando ? '…' : '+ Marco'}
        </button>
      </div>

      {/* Lista */}
      {notas.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {notas.map(n => (
            <li key={n.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '8px 11px', background: 'var(--surface)', borderRadius: 8 }}>
              <span style={{ flex: 'none', fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 56, paddingTop: 1 }}>
                {formatData(n.marcoEm)}
              </span>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>{n.texto}</span>
              <button onClick={() => remover(n.id)} className="btn ghost" style={{ flex: 'none', padding: '1px 7px', fontSize: 11, color: 'var(--rose)' }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatData(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}
