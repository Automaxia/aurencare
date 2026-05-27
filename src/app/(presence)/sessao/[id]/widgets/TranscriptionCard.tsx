'use client'

export type TurnMark = 'insight' | 'comportamento' | 'avanco'

export type Turno = {
  id: string
  who: 'psicologo' | 'paciente'
  texto: string
  ts: string
  mark: TurnMark | null
}

type Props = {
  turnos: Turno[]
  interim?: string
  armed: TurnMark | null
  setArmed: (m: TurnMark | null) => void
  onMark: (turnoId: string) => void
  onToggleWho?: (turnoId: string) => void
}

const MARK_LABEL: Record<TurnMark, string> = {
  insight: 'Insight relevante',
  comportamento: 'Comportamento problema',
  avanco: 'Avanço terapêutico',
}
const MARK_COLOR: Record<TurnMark, 'accent' | 'rose' | 'sage'> = {
  insight: 'accent',
  comportamento: 'rose',
  avanco: 'sage',
}

export function TranscriptionCard({ turnos, interim, armed, setArmed, onMark, onToggleWho }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(Object.keys(MARK_LABEL) as TurnMark[]).map(m => (
          <button
            key={m}
            className={`seg-btn${armed === m ? ' armed' : ''}`}
            data-color={MARK_COLOR[m]}
            onClick={() => setArmed(armed === m ? null : m)}
            type="button"
          >
            {MARK_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="talk-card" style={{ flex: 1 }}>
        {turnos.length === 0 && !interim ? (
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            Aguardando o registro começar… (clique em &quot;Iniciar registro&quot; na barra superior)
          </p>
        ) : (
          <>
            {turnos.map(t => (
              <div
                key={t.id}
                className="turn"
                data-mark={t.mark ?? undefined}
                onClick={() => onMark(t.id)}
                title={armed ? `Marcar como ${MARK_LABEL[armed]}` : 'Selecione um tipo de marcação acima'}
              >
                <button
                  type="button"
                  className="who"
                  data-who={t.who}
                  onClick={(ev) => { ev.stopPropagation(); onToggleWho?.(t.id) }}
                  title="Alternar falante"
                  style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                >
                  {t.who === 'psicologo' ? 'P' : 'C'}:
                </button>{' '}
                {t.texto}
                {t.mark && (
                  <span className="turn-chip" style={{ background: `var(--${MARK_COLOR[t.mark]}-lo)`, color: `var(--${MARK_COLOR[t.mark]})` }}>
                    {MARK_LABEL[t.mark]}
                  </span>
                )}
              </div>
            ))}
            {interim && (
              <div className="turn" style={{ opacity: .55, fontStyle: 'italic' }}>
                <span className="who">…</span>{' '}{interim}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
