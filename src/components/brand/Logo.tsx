import clsx from 'clsx'

/**
 * Espiral de Continuidade — 3 arcos progressivos + ponto final.
 * Conforme CLAUDE.md §4 (Logomarca — Proposta B).
 */
type LogoMarkProps = {
  size?: number
  className?: string
}

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded-[10px]', className)}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #7b5ee8, #5a9e8a)',
      }}
      aria-label="Auren Care"
    >
      <svg
        viewBox="0 0 50 50"
        width={size * 0.74}
        height={size * 0.74}
        fill="none"
        aria-hidden="true"
      >
        {/* Arco 1 — interno */}
        <path
          d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity=".5"
        />
        {/* Arco 2 — médio */}
        <path
          d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity=".75"
        />
        {/* Arco 3 — externo, completo */}
        <path
          d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Ponto final */}
        <circle cx="46" cy="26" r="3" fill="white" />
      </svg>
    </span>
  )
}

type LogoProps = {
  size?: number
  className?: string
  showWordmark?: boolean
}

export function Logo({ size = 32, className, showWordmark = true }: LogoProps) {
  return (
    <div className={clsx('inline-flex items-center gap-3', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-display"
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: size * 0.66,
            lineHeight: 1,
            letterSpacing: '-.01em',
          }}
        >
          <span style={{ fontWeight: 300, color: '#291860' }}>Auren</span>
          <span
            style={{
              fontWeight: 500,
              marginLeft: 4,
              background: 'linear-gradient(90deg, #6a4ec8, #5c9d88)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Care
          </span>
        </span>
      )}
    </div>
  )
}
