'use client'

import type { TurnMark } from './TranscriptionCard'
import { WidgetGrip } from '@/components/WidgetGrip'

const MARK_LABEL: Record<TurnMark, string> = {
  insight: 'Insight relevante',
  comportamento: 'Comportamento problema',
  avanco: 'Avanço terapêutico',
}
const MARK_COLOR: Record<TurnMark, 'accent' | 'rose' | 'sage'> = {
  insight: 'accent', comportamento: 'rose', avanco: 'sage',
}

type Props = {
  pctPsic: number
  pctPac: number
  counts: Record<TurnMark, number>
  /** Marca agora as falas dos últimos segundos com este tipo. */
  onMarcar: (m: TurnMark) => void
  /** Confirmação curta da última marcação (some sozinha). */
  aviso?: string | null
}

/**
 * Widget combinado: Ritmo da conversa + Marcar segmento (com contadores).
 * Mockup v12.5 — combina os dois antigos num único card.
 */
export function RhythmWidget({ pctPsic, pctPac, counts, onMarcar, aviso }: Props) {
  return (
    <div className="talk-card" data-widget-id="ritmo">
      <WidgetGrip />
      <div className="sec-lbl" style={{ marginBottom: 2 }}>Ritmo da conversa</div>

      <div className="rhythm-bars">
        <div className="rhythm-row">
          <div className="rh-lbl"><span>Psicóloga</span><span className="rh-pct">{pctPsic}%</span></div>
          <div className="rh-bar psic"><span style={{ width: `${pctPsic}%` }} /></div>
        </div>
        <div className="rhythm-row">
          <div className="rh-lbl"><span>Paciente</span><span className="rh-pct">{pctPac}%</span></div>
          <div className="rh-bar pac"><span style={{ width: `${pctPac}%` }} /></div>
        </div>
      </div>

      <div className="seg-tags">
        <div className="sec-lbl-sm" title="Marca as falas dos últimos 45 segundos"><span>Marcar segmento · últimos 45s</span></div>
        {(Object.keys(MARK_LABEL) as TurnMark[]).map(m => (
          <button
            key={m}
            type="button"
            className="seg-btn"
            data-color={MARK_COLOR[m]}
            onClick={() => onMarcar(m)}
          >
            <span className="seg-lbl">{MARK_LABEL[m]}</span>
            <span className="seg-cnt">{counts[m]}</span>
          </button>
        ))}
        {aviso && <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 4 }} role="status">✓ {aviso}</div>}
      </div>
    </div>
  )
}
