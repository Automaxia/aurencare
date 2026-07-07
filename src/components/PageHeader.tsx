import { CfpBadge } from './brand/CfpBadge'

type Props = {
  title: React.ReactNode
  subtitle?: string
  /** Pilar da jornada Audere (Preparar · Acompanhar · Conectar · Evoluir) — kicker discreto. */
  pilar?: string
  withCfp?: boolean
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, pilar, withCfp, actions }: Props) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 24, gap: 16 }}>
      <div>
        {pilar && (
          <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>{pilar}</div>
        )}
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>}
        {withCfp && <div style={{ marginTop: 12 }}><CfpBadge /></div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </header>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}
