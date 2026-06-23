/**
 * Campo de formulário padrão: rótulo em cima, conteúdo, e dica/erro opcionais.
 * Fonte única — antes cada form redefinia o seu (com estilos divergentes).
 */
export function Field({ label, hint, error, children }: {
  label: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}
