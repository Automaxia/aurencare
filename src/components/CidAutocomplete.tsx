'use client'

import { useMemo, useRef, useState } from 'react'
import { buscarCid, rotuloCid } from '@/lib/cid10f'

/**
 * Autocomplete de CID-10 (Cap. F). Busca por código, descrição ou palavra-chave.
 * `value` = lista de rótulos selecionados ("F41.1 — Descrição"). Aceita também
 * texto livre (Enter) pra CIDs fora da base curada.
 */
export function CidAutocomplete({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sugestoes = useMemo(() => {
    return buscarCid(query, 8).filter(item => !value.includes(rotuloCid(item)))
  }, [query, value])

  function add(rotulo: string) {
    const r = rotulo.trim()
    if (!r || value.includes(r)) { setQuery(''); return }
    onChange([...value, r])
    setQuery(''); setHl(0)
    inputRef.current?.focus()
  }
  function remove(r: string) {
    onChange(value.filter(v => v !== r))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHl(h => Math.min(h + 1, sugestoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (sugestoes[hl]) add(rotuloCid(sugestoes[hl]))
      else if (query.trim()) add(query.trim())   // texto livre (CID fora da base)
    } else if (e.key === 'Backspace' && !query && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Chips selecionados */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {value.map(r => (
            <span key={r} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 6px 3px 10px', borderRadius: 999, fontSize: 12,
              background: 'rgba(106,78,200,.10)', color: '#391d96',
            }}>
              {r}
              <button type="button" onClick={() => remove(r)} aria-label="Remover"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHl(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Digite código ou condição (ex.: ansiedade, F32, tdah)"
        autoComplete="off"
      />

      {open && sugestoes.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(26,24,37,.12)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
        }}>
          {sugestoes.map((item, i) => (
            <button
              key={item.codigo}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(rotuloCid(item)) }}
              onMouseEnter={() => setHl(i)}
              style={{
                display: 'flex', width: '100%', gap: 10, alignItems: 'baseline',
                padding: '9px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === hl ? 'rgba(106,78,200,.08)' : 'transparent',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: 'var(--accent)', minWidth: 48 }}>{item.codigo}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{item.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
