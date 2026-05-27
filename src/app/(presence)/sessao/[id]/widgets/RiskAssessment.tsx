'use client'

type Level = 'lo' | 'md' | 'hi'
type Risco = { autolesao: Level; ideacao: Level; plano: Level }

const ROWS: { key: keyof Risco; label: string }[] = [
  { key: 'autolesao', label: 'Autolesão' },
  { key: 'ideacao',   label: 'Pensamentos suicidas' },
  { key: 'plano',     label: 'Plano suicida' },
]

const LEVELS: { v: Level; l: string }[] = [
  { v: 'lo', l: 'Baixo' },
  { v: 'md', l: 'Médio' },
  { v: 'hi', l: 'Alto' },
]

function nivelGeral(r: Risco): string {
  if (r.plano === 'hi' || r.ideacao === 'hi' || r.autolesao === 'hi') return 'Alto · alerta'
  if (r.plano === 'md' || r.ideacao === 'md' || r.autolesao === 'md') return 'Atenção moderada'
  return 'Estável'
}

export function RiskAssessment({ value, onChange }: { value: Risco; onChange: (r: Risco) => void }) {
  return (
    <div className="talk-card" data-widget-id="risco">
      <div className="widget-grip" title="Arraste para reorganizar">⠿</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="sec-lbl" style={{ marginBottom: 2 }}>Avaliação de risco</div>
        <div style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: .6 }}>agora</div>
      </div>
      <div className="risk-list">
        {ROWS.map(row => (
          <div key={row.key} className="risk-row" data-key={row.key}>
            <div className="risk-name">{row.label}</div>
            <div className="risk-pills">
              {LEVELS.map(l => (
                <button
                  key={l.v} type="button"
                  className={`risk-pill ${l.v}${value[row.key] === l.v ? ' on' : ''}`}
                  onClick={() => onChange({ ...value, [row.key]: l.v })}
                >
                  {l.l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="risk-foot">
        <span>nível geral</span>
        <span className="summary">{nivelGeral(value)}</span>
      </div>
    </div>
  )
}
