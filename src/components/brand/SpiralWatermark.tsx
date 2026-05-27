/**
 * Watermark decorativa da Espiral de Continuidade.
 * Usar como elemento absoluto em fundos de páginas (dashboard, hero areas).
 */
export function SpiralWatermark({
  size = 120, opacity = .06, top = 28, right = 28,
}: { size?: number; opacity?: number; top?: number; right?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', top, right, opacity, pointerEvents: 'none' }}
    >
      <svg width={size} height={size} viewBox="0 0 50 50" fill="none">
        <path d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26"  stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <circle cx="46" cy="26" r="2" fill="var(--accent)" />
      </svg>
    </div>
  )
}
