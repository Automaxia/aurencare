'use client'

import { useEffect, useState } from 'react'
import { CfpBadge } from '@/components/brand/CfpBadge'

type Insight = { tom: 'positivo' | 'atencao' | 'neutro'; texto: string }

const TOM_BG: Record<Insight['tom'], string> = {
  positivo: 'rgba(90,158,138,.07)',
  atencao:  'rgba(176,125,64,.07)',
  neutro:   'var(--surface)',
}
const TOM_BORDER: Record<Insight['tom'], string> = {
  positivo: 'rgba(90,158,138,.18)',
  atencao:  'rgba(176,125,64,.18)',
  neutro:   'var(--border)',
}
const TOM_ICO: Record<Insight['tom'], string> = {
  positivo: '✓',
  atencao:  '◷',
  neutro:   '·',
}
const TOM_COLOR: Record<Insight['tom'], string> = {
  positivo: 'var(--sage)',
  atencao:  'var(--amber)',
  neutro:   'var(--muted)',
}

export function SaudeInsights() {
  const [items, setItems] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/saude/insights')
      .then(r => r.json())
      .then(j => setItems(Array.isArray(j?.insights) ? j.insights : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-h" style={{ padding: '14px 18px' }}>
        <span className="card-title">Observações da sua prática</span>
        <CfpBadge />
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Sem observações ainda — volte após algumas sessões assinadas.
          </div>
        ) : (
          items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 'var(--rsm)',
              background: TOM_BG[it.tom], border: `1px solid ${TOM_BORDER[it.tom]}`,
            }}>
              <span style={{ fontSize: 13, color: TOM_COLOR[it.tom], fontWeight: 500, lineHeight: 1.6 }}>
                {TOM_ICO[it.tom]}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {it.texto}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          height: 38, background: 'var(--surface)', borderRadius: 'var(--rsm)',
          opacity: 1 - i * 0.18,
        }} />
      ))}
    </>
  )
}
