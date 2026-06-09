'use client'

import { useMemo } from 'react'
import { WidgetGrip } from '@/components/WidgetGrip'

/**
 * Checagem de humor — rica. Mockup v12.5.
 * Estado emocional bipolar (−5..+5) + 3 momentos + 3 escalas F/I/D.
 */

const EMO_LABELS: Record<number, string> = {
  [-5]: 'Extremamente desagradável', [-4]: 'Muito desagradável', [-3]: 'Desagradável',
  [-2]: 'Levemente desagradável', [-1]: 'Pouco desagradável',
  0: 'Neutro',
  1: 'Pouco agradável', 2: 'Levemente agradável', 3: 'Agradável',
  4: 'Muito agradável', 5: 'Extremamente agradável',
}

const SCALE_LABELS = {
  freq: [[0, 'Nunca'], [20, 'Algumas vezes'], [40, 'Diariamente'], [60, 'Muitas vezes ao dia'], [85, 'O tempo todo']] as const,
  int:  [[0, 'Nenhum'], [25, 'Leve'], [50, 'Moderado'], [75, 'Forte'], [90, 'Extremo']] as const,
  dur:  [[0, 'Sem humor'], [15, '1h ou menos'], [35, '2–4 horas'], [55, '8–12 horas'], [75, '1–2 dias'], [90, '7 dias']] as const,
}

export type Momento = { texto: string; intensidade: number }  // intensidade 1..5
export type HumorState = {
  estado: number               // -5..5 (estado emocional)
  predominante: Momento
  inicio: Momento
  fim: Momento
  freq: number                 // 0..100
  int: number
  dur: number
}

export const initialHumor: HumorState = {
  estado: 0,
  predominante: { texto: '', intensidade: 3 },
  inicio:       { texto: '', intensidade: 3 },
  fim:          { texto: '', intensidade: 3 },
  freq: 50, int: 50, dur: 35,
}

function labelFromScale(val: number, marks: readonly (readonly [number, string])[]): string {
  let chosen = marks[0][1]
  for (const [n, l] of marks) if (val >= n) chosen = l
  return chosen
}

type Props = { value: HumorState; onChange: (v: HumorState) => void; className?: string }

export function HumorCheck({ value, onChange, className }: Props) {
  const update = (patch: Partial<HumorState>) => onChange({ ...value, ...patch })
  const updateMoment = (key: 'predominante' | 'inicio' | 'fim', patch: Partial<Momento>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } })

  const estadoPct = useMemo(() => ((value.estado + 5) / 10) * 100, [value.estado])

  return (
    <div className={`talk-card wide ${className ?? ''}`} data-widget-id="humor">
      <WidgetGrip />
      <div className="sec-lbl" style={{ marginBottom: 2 }}>Checagem de humor</div>

      {/* Estado emocional bipolar */}
      <div className="emo-state">
        <div className="emo-head">
          <div className="emo-label">Estado emocional <span className="sub">esta semana</span></div>
          <div className="emo-value">{EMO_LABELS[value.estado]}</div>
        </div>
        <div className="emo-slider">
          <div className="emo-track" />
          <div className="emo-ticks">
            <span className="tk" /><span className="tk" /><span className="tk" /><span className="tk" /><span className="tk" />
            <span className="tk center" />
            <span className="tk" /><span className="tk" /><span className="tk" /><span className="tk" /><span className="tk" />
          </div>
          <div className="emo-thumb" style={{ left: `${estadoPct}%` }} />
          <input
            type="range" min={-5} max={5} step={1}
            value={value.estado}
            onChange={e => update({ estado: +e.target.value })}
          />
        </div>
        <div className="emo-anchors">
          <span className="left">Desagradável</span>
          <span>Neutro</span>
          <span className="right">Agradável</span>
        </div>
      </div>

      {/* 3 momentos */}
      <div className="mood-moments">
        {(['predominante', 'inicio', 'fim'] as const).map(key => {
          const m = value[key]
          const label = key === 'predominante' ? 'Predominante' : key === 'inicio' ? 'Início da sessão' : 'Final da sessão'
          return (
            <div key={key} className="moment">
              <div className="when">{label}</div>
              <input
                className="mood-input"
                type="text" value={m.texto}
                onChange={e => updateMoment(key, { texto: e.target.value })}
                placeholder="ex: tenso"
              />
              <div className="intensity-row">
                <div className="intensity-dots">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} className={i <= m.intensidade ? 'on' : ''} onClick={() => updateMoment(key, { intensidade: i })} aria-label={`intensidade ${i}`} />
                  ))}
                </div>
                <div className="intensity-lbl">Intensidade · {m.intensidade}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3 escalas F/I/D */}
      <div className="scales">
        {(['freq', 'int', 'dur'] as const).map(key => {
          const val = value[key]
          const marks = SCALE_LABELS[key]
          const title = key === 'freq' ? 'Frequência' : key === 'int' ? 'Intensidade' : 'Duração'
          const anchors = key === 'freq'
            ? ['nunca', 'algumas vezes', 'o tempo todo']
            : key === 'int'
            ? ['nenhum', 'leve', 'extremo']
            : ['sem humor', '4–8h', '7 dias']
          return (
            <div key={key} className="scale" data-scale={key}>
              <div className="sc-head">
                <span>{title}</span>
                <span className="sc-val">{labelFromScale(val, marks)}</span>
              </div>
              <div className="sc-track">
                <div className="sc-fill" style={{ width: `${val}%` }} />
                <div className="sc-thumb" style={{ left: `${val}%` }} />
                <input type="range" min={0} max={100} value={val} onChange={e => update({ [key]: +e.target.value } as any)} />
              </div>
              <div className="sc-anchors">{anchors.map(a => <span key={a}>{a}</span>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
