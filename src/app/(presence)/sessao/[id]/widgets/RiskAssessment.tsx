'use client'

type Level = 'lo' | 'md' | 'hi'
type Risco = { autolesao: Level; ideacao: Level; plano: Level }

const ROWS: { key: keyof Risco; label: string }[] = [
  { key: 'autolesao', label: 'Autolesão' },
  { key: 'ideacao',   label: 'Ideação' },
  { key: 'plano',     label: 'Plano' },
]

const LEVELS: { v: Level; l: string }[] = [
  { v: 'lo', l: 'Baixo' },
  { v: 'md', l: 'Médio' },
  { v: 'hi', l: 'Alto' },
]

export function RiskAssessment({ value, onChange }: { value: Risco; onChange: (r: Risco) => void }) {
  return (
    <div className="widget" data-widget-id="risco">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">Avaliação de risco</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {ROWS.map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{row.label}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {LEVELS.map(l => (
                <button
                  key={l.v}
                  className={`risk-pill ${l.v}${value[row.key] === l.v ? ' on' : ''}`}
                  onClick={() => onChange({ ...value, [row.key]: l.v })}
                  type="button"
                >
                  {l.l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
