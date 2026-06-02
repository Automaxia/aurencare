'use client'

import type { MetricaTipo, MetricaDirecao } from '@/server/services/objetivos'

/**
 * Bullet Chart horizontal (estilo Carepatron/EHR) — apresentação principal
 * de progresso por objetivo. Mostra de uma vez:
 *   baseline ────────[track preenchido]──────── alvo
 *                        ▲ valor atual · xx%
 *
 * Em GAS, o domínio é fixo -2 a +2 (escala padrão).
 * Em métrica absoluta, o domínio é [baseline, alvo] com 10% de folga em cada
 * lado pra mostrar regressão (abaixo do baseline) e ultrapassagem (acima do alvo).
 */

type Props = {
  baseline: number | null
  alvo: number | null
  atual: number | null
  direcao: MetricaDirecao
  tipo: MetricaTipo
  unidade: string | null
  /** Variação vs medição anterior (positivo = melhorou, negativo = piorou). */
  delta?: number | null
  size?: 'sm' | 'lg'
}

export function BulletChart(p: Props) {
  const noAlvo = p.atual != null && p.baseline != null && p.alvo != null && atingiu(p.atual, p.alvo, p.direcao)

  // Define domínio visual
  const { domMin, domMax } = computarDominio(p)
  const x = (v: number) => clamp01((v - domMin) / (domMax - domMin)) * 100

  const baselinePos = p.baseline != null ? x(p.baseline) : null
  const alvoPos     = p.alvo != null ? x(p.alvo) : null
  const atualPos    = p.atual != null ? x(p.atual) : null

  // O preenchimento vai do baseline ao atual (sem importar a direção)
  const preencheDe = baselinePos != null && atualPos != null
    ? Math.min(baselinePos, atualPos) : 0
  const preencheAte = baselinePos != null && atualPos != null
    ? Math.max(baselinePos, atualPos) : 0

  const pct = calcularProgresso(p.baseline, p.alvo, p.atual, p.direcao)

  const isLg = p.size === 'lg'
  const trackHeight = isLg ? 14 : 10
  const labelSize = isLg ? 11 : 10
  const valorSize = isLg ? 16 : 13

  // Cor de preenchimento — sage no alvo, accent caso contrário
  const fillColor = noAlvo ? 'var(--sage)' : 'var(--accent)'

  return (
    <div style={{ width: '100%', display: 'grid', gap: 6 }}>
      {/* Labels de baseline e alvo */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: labelSize, color: 'var(--muted)',
        fontFamily: 'var(--font-mono), monospace',
      }}>
        <span>
          {p.baseline != null ? `baseline ${formatNum(p.baseline)}` : '—'}
        </span>
        <span style={{ color: noAlvo ? 'var(--sage)' : 'var(--muted)', fontWeight: noAlvo ? 500 : 400 }}>
          {p.alvo != null ? `alvo ${formatNum(p.alvo)}` : '—'}
        </span>
      </div>

      {/* Track + preenchimento + marcador atual */}
      <div style={{ position: 'relative', height: trackHeight, marginBottom: 18 }}>
        {/* Track */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--surface)', borderRadius: 999,
          border: '1px solid var(--border)',
        }} />

        {/* Preenchimento baseline → atual */}
        {p.atual != null && p.baseline != null && (
          <div style={{
            position: 'absolute',
            left: `${preencheDe}%`,
            width: `${preencheAte - preencheDe}%`,
            top: 0, height: '100%',
            background: fillColor, opacity: .82,
            borderRadius: 999,
            transition: 'all .4s var(--ease)',
          }} />
        )}

        {/* Tick do alvo (linha vertical fina) */}
        {alvoPos != null && (
          <div style={{
            position: 'absolute', left: `${alvoPos}%`, top: -3,
            width: 2, height: trackHeight + 6,
            background: 'var(--sage)',
            transform: 'translateX(-1px)',
          }} title={`alvo ${formatNum(p.alvo!)}`} />
        )}

        {/* Tick do baseline (linha vertical mais sutil) */}
        {baselinePos != null && (
          <div style={{
            position: 'absolute', left: `${baselinePos}%`, top: -3,
            width: 1.5, height: trackHeight + 6,
            background: 'var(--muted)', opacity: .5,
            transform: 'translateX(-.75px)',
          }} title={`baseline ${formatNum(p.baseline!)}`} />
        )}

        {/* Marcador do valor atual — triângulo abaixo + label */}
        {atualPos != null && (
          <div style={{
            position: 'absolute',
            left: `${atualPos}%`,
            top: trackHeight + 2,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 10, lineHeight: 1, color: fillColor, marginBottom: -2 }}>▲</span>
            <span style={{
              fontSize: valorSize, fontWeight: 500, color: 'var(--ink)',
              fontFamily: 'var(--font-mono), monospace',
              lineHeight: 1.2,
            }}>
              {formatNum(p.atual!)}
            </span>
          </div>
        )}
      </div>

      {/* Status linha embaixo */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        fontSize: 11, color: 'var(--muted)',
      }}>
        <span style={{
          color: noAlvo ? 'var(--sage)' : pct >= 50 ? 'var(--ink-soft)' : 'var(--muted)',
          fontWeight: 500,
        }}>
          {noAlvo ? '✓ no alvo' : `${pct}% do trajeto`}
        </span>

        {p.delta != null && p.delta !== 0 && (
          <span style={{ color: p.delta > 0 ? 'var(--sage)' : 'var(--rose)' }}>
            {p.delta > 0 ? '↑' : '↓'} {formatNum(Math.abs(p.delta))} vs medição anterior
          </span>
        )}

        {p.unidade && <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>{p.unidade}</span>}
        {p.tipo === 'gas' && <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>GAS</span>}
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function computarDominio(p: Props): { domMin: number; domMax: number } {
  if (p.tipo === 'gas') return { domMin: -2, domMax: 2 }
  const b = p.baseline ?? 0
  const a = p.alvo ?? (b + 1)
  const lo = Math.min(b, a, p.atual ?? b)
  const hi = Math.max(b, a, p.atual ?? a)
  const span = hi - lo || 1
  // Folga de 10% pra cada lado pra visualizar regressão/ultrapassagem
  return { domMin: lo - span * 0.10, domMax: hi + span * 0.10 }
}

function atingiu(atual: number, alvo: number, direcao: MetricaDirecao): boolean {
  return direcao === 'aumentar' ? atual >= alvo : atual <= alvo
}

function calcularProgresso(
  baseline: number | null, alvo: number | null, atual: number | null, direcao: MetricaDirecao,
): number {
  if (baseline == null || alvo == null || atual == null || baseline === alvo) return 0
  const num = direcao === 'aumentar' ? atual - baseline : baseline - atual
  const den = direcao === 'aumentar' ? alvo - baseline : baseline - alvo
  return Math.max(0, Math.min(100, Math.round((num / den) * 100)))
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(2).replace(/\.?0+$/, '')
}
