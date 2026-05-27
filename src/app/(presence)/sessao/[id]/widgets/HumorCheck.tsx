'use client'

const EMO_LABELS: Record<string, string> = {
  '-5': 'Extremamente desagradável',
  '-4': 'Muito desagradável',
  '-3': 'Desagradável',
  '-2': 'Levemente desagradável',
  '-1': 'Pouco desagradável',
   '0': 'Neutro',
   '1': 'Pouco agradável',
   '2': 'Levemente agradável',
   '3': 'Agradável',
   '4': 'Muito agradável',
   '5': 'Extremamente agradável',
}

type Humor = { inicio: number; meio: number; fim: number }

export function HumorCheck({ humor, onChange }: { humor: Humor; onChange: (h: Humor) => void }) {
  return (
    <div className="widget wide" data-widget-id="humor">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">Checagem de humor</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {(['inicio','meio','fim'] as const).map(momento => (
          <div key={momento}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>{momento === 'inicio' ? 'Início' : momento === 'meio' ? 'Meio' : 'Fim'}</span>
              <span style={{ fontWeight: 500 }}>{humor[momento]}</span>
            </div>
            <input
              type="range" min={-5} max={5} step={1}
              value={humor[momento]}
              onChange={e => onChange({ ...humor, [momento]: +e.target.value })}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div className="emo-track" />
            <span className="emo-label">{EMO_LABELS[String(humor[momento])]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
