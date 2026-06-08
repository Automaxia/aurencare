import { LogoMark } from './Logo'

/** Logo do Audere girando — indicador de carregamento da marca. */
export function AudereSpinner({ size = 40 }: { size?: number }) {
  return <LogoMark size={size} className="audere-spin" />
}

/** Overlay de tela cheia com a logo girando — para carregamentos/transições. */
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <AudereSpinner size={46} />
      {label && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>}
    </div>
  )
}

/** Feedback claro de "salvo" — pill verde que entra com pop. */
export function SavedBadge({ label = 'Salvo' }: { label?: string }) {
  return (
    <span className="saved-pop" style={{
      padding: '5px 12px', borderRadius: 999,
      background: 'rgba(90,158,138,.14)', color: '#2a6456',
      fontSize: 12.5, fontWeight: 500,
    }}>
      <span style={{
        display: 'inline-flex', width: 16, height: 16, borderRadius: '50%',
        background: 'var(--sage)', color: '#fff',
        alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
      }}>✓</span>
      {label}
    </span>
  )
}
