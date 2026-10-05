'use client'

/**
 * Valor em reais, livre até o centavo (ex: 199,67). Aceita vírgula ou ponto.
 * As setas ↑/↓ do teclado sugerem de 10 em 10, mas não prendem o valor nesse passo.
 * `value`/`onChange` trabalham em número (reais); null = vazio.
 */
import { useEffect, useState } from 'react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function parseValor(texto: string): number | null {
  const t = texto.trim().replace(/[^\d.,]/g, '')
  if (!t) return null
  // "1.234,56" (BR) → tira o milhar; "1.500" → milhar; "199.67" → ponto é decimal.
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t
  const n = Number(normal)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function ValorInput({ value, onChange, passo = 10, disabled, placeholder = '0,00', style }: {
  value: number | null
  onChange: (v: number | null) => void
  passo?: number
  disabled?: boolean
  placeholder?: string
  style?: React.CSSProperties
}) {
  const [texto, setTexto] = useState(value === null ? '' : fmt(value))
  const [editando, setEditando] = useState(false)

  // Mudança vinda de fora (ex: "gratuita" zera) — não atropela o que está sendo digitado.
  useEffect(() => {
    if (!editando) setTexto(value === null ? '' : fmt(value))
  }, [value, editando])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const atual = parseValor(texto) ?? 0
    // Sobe/desce até o próximo múltiplo do passo (199,67 ↑ 200,00 ↑ 210,00).
    const novo = e.key === 'ArrowUp'
      ? Math.floor(atual / passo + 1e-9) * passo + passo
      : Math.max(0, Math.ceil(atual / passo - 1e-9) * passo - passo)
    setTexto(fmt(novo))
    onChange(novo)
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        fontSize: 13, color: 'var(--muted)', pointerEvents: 'none', opacity: disabled ? .5 : 1,
      }}>R$</span>
      <input
        inputMode="decimal"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setEditando(true)}
        onBlur={() => {
          setEditando(false)
          const v = parseValor(texto)
          setTexto(v === null ? '' : fmt(v))
        }}
        onChange={e => {
          const t = e.target.value.replace(/[^\d.,]/g, '')
          setTexto(t)
          onChange(parseValor(t))
        }}
        onKeyDown={onKeyDown}
        style={{ ...style, paddingLeft: 36 }}
      />
      <style jsx>{`
        input {
          width: 100%; padding: 8px 12px; border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          font-variant-numeric: tabular-nums;
          transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        input:hover { border-color: var(--field-border-hover); }
        input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        input:disabled { opacity: .5; }
      `}</style>
    </div>
  )
}
