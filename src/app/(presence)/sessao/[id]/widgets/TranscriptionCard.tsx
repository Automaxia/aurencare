'use client'

import { WidgetGrip } from '@/components/WidgetGrip'

export type TurnMark = 'insight' | 'comportamento' | 'avanco'
export type TurnTone = 'calm' | 'tense' | 'open' | 'closed' | 'anxious' | 'acolhedor' | null

export type Turno = {
  id: string
  who: 'psicologo' | 'paciente'
  texto: string
  ts: string
  mark: TurnMark | null
  tone?: TurnTone
}

type Props = {
  turnos: Turno[]
  interim?: string
  armed: TurnMark | null
  setArmed: (m: TurnMark | null) => void
  onMark: (turnoId: string) => void
  onToggleWho?: (turnoId: string) => void
  recording: boolean
}

const MARK_LABEL: Record<TurnMark, string> = {
  insight: 'insight',
  comportamento: 'comportamento',
  avanco: 'avanço',
}

const TONE_LABEL: Record<NonNullable<TurnTone>, string> = {
  calm: 'calmo', tense: 'tenso', open: 'aberto',
  closed: 'fechado', anxious: 'ansioso', acolhedor: 'acolhedor',
}

export function TranscriptionCard({ turnos, interim, armed: _armed, setArmed: _setArmed, onMark, onToggleWho, recording }: Props) {
  return (
    <div className="trans-card">
      <div className="trans-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <WidgetGrip size={11} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>Registro assistido</span>
        </div>
        {recording && (
          <div className="live-pill">
            <div className="live-d" />
            Presente
          </div>
        )}
      </div>

      <div className="trans-body">
        {turnos.length === 0 && !interim ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {recording
              ? 'Escutando… as falas aparecerão aqui conforme você e o paciente conversarem.'
              : 'Aguardando o registro começar… clique em "Iniciar registro" na barra superior.'}
          </p>
        ) : (
          <>
            {turnos.map(t => (
              <div
                key={t.id}
                className={`turn armable${t.who === 'psicologo' ? ' psic' : ''}`}
                data-mark={t.mark ?? undefined}
                onClick={() => onMark(t.id)}
              >
                {t.mark && <div className="mark-chip">{MARK_LABEL[t.mark]}</div>}
                <div className="turn-top">
                  <button
                    type="button" className="t-sp"
                    onClick={(ev) => { ev.stopPropagation(); onToggleWho?.(t.id) }}
                    title="Alternar falante"
                  >
                    {t.who === 'psicologo' ? 'Psicóloga' : 'Paciente'}
                  </button>
                  <span className="t-time">{formatTime(t.ts)}</span>
                  {t.tone && <span className={`t-tone tn-${t.tone}`}>{TONE_LABEL[t.tone] ?? t.tone}</span>}
                </div>
                <div className="turn-txt">{t.texto}</div>
              </div>
            ))}
            {interim && (
              <div className="turn" style={{ opacity: .45 }}>
                <div className="turn-top">
                  <span className="t-sp" style={{ color: 'var(--faint)' }}>…</span>
                </div>
                <div className="turn-txt" style={{ fontStyle: 'italic' }}>{interim}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
