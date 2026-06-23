'use client'

import { useState } from 'react'
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

// Descrição de cada tom (legenda + tooltip) — #4: o usuário não sabia o significado.
const TONE_DESC: Record<NonNullable<TurnTone>, string> = {
  calm:      'calmo, sereno, regulado',
  tense:     'tenso, retraído, defensivo',
  open:      'aberto, em contato com a própria experiência',
  closed:    'fechado, evasivo, monossilábico',
  anxious:   'ansioso, ruminativo, acelerado',
  acolhedor: 'acolhedor, validador (geralmente da psicóloga)',
}

export function TranscriptionCard({ turnos, interim, armed: _armed, setArmed: _setArmed, onMark, onToggleWho, recording }: Props) {
  const [legendaTons, setLegendaTons] = useState(false)
  // #5: mais recente no topo (ordena por timestamp desc — robusto a chegada fora de ordem).
  const ordenados = [...turnos].sort((a, b) => +new Date(b.ts) - +new Date(a.ts))

  return (
    <div className="trans-card">
      <div className="trans-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <WidgetGrip size={11} />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>Registro assistido</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setLegendaTons(v => !v)}
            style={{
              fontSize: 11, color: legendaTons ? 'var(--accent)' : 'var(--muted)',
              background: 'none', border: '1px solid var(--border)', borderRadius: 999,
              padding: '3px 9px', cursor: 'pointer',
            }}
            title="O que cada tom significa"
          >
            tons ⓘ
          </button>
          {recording && (
            <div className="live-pill">
              <div className="live-d" />
              Presente
            </div>
          )}
        </div>
      </div>

      {legendaTons && (
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          display: 'grid', gap: 6, background: 'var(--surface)',
        }}>
          {(Object.keys(TONE_LABEL) as NonNullable<TurnTone>[]).map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <span className={`t-tone tn-${k}`} style={{ flexShrink: 0 }}>{TONE_LABEL[k]}</span>
              <span style={{ color: 'var(--muted)' }}>{TONE_DESC[k]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="trans-body">
        {turnos.length === 0 && !interim ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {recording
              ? 'Escutando… as falas aparecerão aqui conforme você e o paciente conversarem.'
              : 'Aguardando o registro começar… clique em "Iniciar registro" na barra superior.'}
          </p>
        ) : (
          <>
            {interim && (
              <div className="turn" style={{ opacity: .45 }}>
                <div className="turn-top">
                  <span className="t-sp" style={{ color: 'var(--faint)' }}>…</span>
                </div>
                <div className="turn-txt" style={{ fontStyle: 'italic' }}>{interim}</div>
              </div>
            )}
            {ordenados.map(t => (
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
                  {t.tone && <span className={`t-tone tn-${t.tone}`} title={TONE_DESC[t.tone]}>{TONE_LABEL[t.tone] ?? t.tone}</span>}
                </div>
                <div className="turn-txt">{t.texto}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
