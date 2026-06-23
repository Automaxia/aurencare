/**
 * Mini-gráfico de tendência das medições de um objetivo. Direção-aware: pinta
 * verde quando a métrica caminha na direção do objetivo (subir p/ 'aumentar',
 * descer p/ 'diminuir'), rose quando vai contra, neutro quando estável.
 * Puro (sem estado) — só dados.
 */
export function Sparkline({ valores, direcao }: { valores: number[]; direcao: 'aumentar' | 'diminuir' }) {
  if (valores.length < 2) return null

  const W = 100, H = 26, P = 3
  const min = Math.min(...valores), max = Math.max(...valores)
  const range = max - min || 1
  const w = W - P * 2, h = H - P * 2
  const pts = valores.map((v, i) => ({
    x: P + (i / (valores.length - 1)) * w,
    y: P + (1 - (v - min) / range) * h,
  }))
  const d = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]

  const variou = valores[valores.length - 1] - valores[0]
  const melhora = direcao === 'aumentar' ? variou > 0 : variou < 0
  const piora   = direcao === 'aumentar' ? variou < 0 : variou > 0
  const cor = melhora ? 'var(--sage)' : piora ? 'var(--rose)' : 'var(--muted)'
  const seta = variou === 0 ? '→' : variou > 0 ? '↑' : '↓'
  const mag = Math.round(Math.abs(variou) * 10) / 10

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <svg width={W} height={H} style={{ display: 'block' }} aria-hidden="true">
        <polyline points={d} fill="none" stroke={cor} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r={2.4} fill={cor} />
      </svg>
      <span style={{ fontSize: 11, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{seta} {mag}</span>
    </span>
  )
}
