'use client'

import type { MetricaTipo, MetricaDirecao } from '@/server/services/objetivos'

/**
 * Gráfico SVG inline da evolução de um objetivo:
 * - Linha do valor real medido (com pontos)
 * - Linha tracejada baseline (cinza)
 * - Linha tracejada alvo (sage)
 * - Vlines cinzas em datas de sessão
 *
 * Sem libs — controlamos o domínio do Y a partir de baseline/alvo/medições,
 * e o X a partir das datas (igualmente espaçadas, não temporal real — mais
 * útil pra ler progresso entre pontos do que escala temporal exata).
 */

type Props = {
  baseline: number | null
  alvo: number | null
  direcao: MetricaDirecao
  tipo: MetricaTipo
  unidade: string | null
  medicoes: Array<{ data: string; valor: number }>
  sessoes: string[]    // datas YYYY-MM-DD
}

const PAD = { top: 18, right: 14, bottom: 24, left: 36 }
const W = 520
const H = 200

export function EvolucaoChart(p: Props) {
  if (p.medicoes.length === 0) {
    return (
      <div style={{
        height: H, display: 'grid', placeItems: 'center',
        background: 'var(--surface)', borderRadius: 'var(--rsm)',
        color: 'var(--faint)', fontSize: 12,
      }}>
        Registre a primeira medição abaixo pra ver a evolução.
      </div>
    )
  }

  // Domínio Y: cobre baseline, alvo, e min/max das medições — com folga 10%
  const valores = p.medicoes.map(m => m.valor)
  const candidatos = [...valores, p.baseline, p.alvo].filter((v): v is number => v != null)
  let yMin = Math.min(...candidatos)
  let yMax = Math.max(...candidatos)
  if (p.tipo === 'gas') { yMin = -2; yMax = 2 }
  if (yMin === yMax) { yMin -= 1; yMax += 1 }
  const yPad = (yMax - yMin) * 0.10
  yMin -= yPad; yMax += yPad

  // Domínio X: índices das medições igualmente espaçados
  const xMin = 0
  const xMax = Math.max(1, p.medicoes.length - 1)

  const xScale = (i: number) => PAD.left + (i - xMin) / (xMax - xMin) * (W - PAD.left - PAD.right)
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  // Path da linha de medições
  const linePath = p.medicoes.map((m, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(m.valor)}`).join(' ')

  // Mapa data → índice (pra colocar vlines de sessões em x correto)
  // Se a sessão é entre duas medições, fica aproximadamente proporcional na timeline.
  const datasMedicoes = p.medicoes.map(m => +new Date(m.data))
  const tMin = datasMedicoes[0]
  const tMax = datasMedicoes[datasMedicoes.length - 1]
  function xFromData(dataIso: string): number | null {
    const t = +new Date(dataIso)
    if (tMax === tMin) return null
    if (t < tMin || t > tMax) return null
    const rel = (t - tMin) / (tMax - tMin)
    return PAD.left + rel * (W - PAD.left - PAD.right)
  }

  // Cor dos pontos: progrediu (na direção certa em relação ao anterior) = sage; regrediu = rose
  function corPonto(i: number): string {
    if (i === 0) return 'var(--accent)'
    const ant = p.medicoes[i - 1].valor
    const at = p.medicoes[i].valor
    if (at === ant) return 'var(--accent)'
    const melhorou = p.direcao === 'aumentar' ? at > ant : at < ant
    return melhorou ? 'var(--sage)' : 'var(--rose)'
  }

  // Ticks do Y: 4 linhas guia
  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i / yTicks) * (yMax - yMin))

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Evolução do objetivo">
        {/* Y grid */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={PAD.left - 6} y={yScale(v) + 3} fontSize={9} fill="var(--muted)" textAnchor="end" fontFamily="var(--font-mono), monospace">
              {formatTick(v, p.tipo)}
            </text>
          </g>
        ))}

        {/* Vlines de sessões */}
        {p.sessoes.map((sd, i) => {
          const x = xFromData(sd); if (x == null) return null
          return (
            <line key={`s-${i}`} x1={x} x2={x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="rgba(122,117,144,.25)" strokeDasharray="1 3" />
          )
        })}

        {/* Baseline */}
        {p.baseline != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={yScale(p.baseline)} y2={yScale(p.baseline)}
              stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1.2} />
            <text x={W - PAD.right} y={yScale(p.baseline) - 4} fontSize={9} fill="var(--muted)" textAnchor="end">
              baseline {formatTick(p.baseline, p.tipo)}
            </text>
          </g>
        )}

        {/* Alvo */}
        {p.alvo != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={yScale(p.alvo)} y2={yScale(p.alvo)}
              stroke="var(--sage)" strokeDasharray="4 4" strokeWidth={1.4} />
            <text x={W - PAD.right} y={yScale(p.alvo) - 4} fontSize={9} fill="var(--sage)" textAnchor="end" fontWeight={500}>
              alvo {formatTick(p.alvo, p.tipo)}
            </text>
          </g>
        )}

        {/* Linha de medições */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {p.medicoes.map((m, i) => (
          <g key={`p-${i}`}>
            <circle cx={xScale(i)} cy={yScale(m.valor)} r={5} fill={corPonto(i)} stroke="var(--card)" strokeWidth={2} />
            <title>{m.data} · {formatTick(m.valor, p.tipo)}</title>
          </g>
        ))}

        {/* Eixo X — datas das medições (compactas) */}
        {p.medicoes.map((m, i) => {
          // Mostra só ~4 labels pra não poluir
          const skip = Math.max(1, Math.floor(p.medicoes.length / 4))
          if (i % skip !== 0 && i !== p.medicoes.length - 1) return null
          return (
            <text key={`x-${i}`} x={xScale(i)} y={H - 6} fontSize={9} fill="var(--muted)" textAnchor="middle">
              {formatDataCurta(m.data)}
            </text>
          )
        })}
      </svg>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap', paddingLeft: PAD.left }}>
        <Leg cor="var(--accent)" texto="medições" />
        <Leg cor="var(--muted)" texto="baseline" dashed />
        <Leg cor="var(--sage)" texto="alvo" dashed />
        {p.sessoes.length > 0 && <Leg cor="rgba(122,117,144,.5)" texto="sessões" dashed />}
        {p.unidade && <span style={{ marginLeft: 'auto' }}>unidade: {p.unidade}</span>}
      </div>
    </div>
  )
}

function Leg({ cor, texto, dashed }: { cor: string; texto: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 14, height: 0,
        borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${cor}`,
      }} />
      {texto}
    </span>
  )
}

function formatTick(v: number, tipo: MetricaTipo): string {
  if (tipo === 'gas') return v > 0 ? `+${v}` : `${v}`
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(1)
}

function formatDataCurta(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
