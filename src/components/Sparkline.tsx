/**
 * Mini sparkline SVG — pra exibir tendências discretas no perfil.
 * Renderiza linha + área leve + pontinhos opcionais.
 */
type Props = {
  values: number[]
  width?: number
  height?: number
  color?: string
  fillOpacity?: number
  showDots?: boolean
  ariaLabel?: string
}

export function Sparkline({
  values, width = 120, height = 28,
  color = 'var(--accent)', fillOpacity = .12,
  showDots = false, ariaLabel,
}: Props) {
  if (!values.length) return <div style={{ width, height }} />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / Math.max(1, values.length - 1)
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * height,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg className="spark-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
      <path d={area} fill={color} opacity={fillOpacity} />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.8" fill={color} />
      ))}
    </svg>
  )
}
