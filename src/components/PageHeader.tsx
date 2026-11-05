import { CfpBadge } from './brand/CfpBadge'

type Props = {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Pilar da jornada Audere (Preparar · Acompanhar · Conectar · Evoluir) — kicker discreto. */
  pilar?: string
  withCfp?: boolean
  actions?: React.ReactNode
}

/** Cabeçalho único de página — estilos em globals.css (.page-h*). Não sobrescreva
 *  tamanho/margem por página: o objetivo é todas as telas terem o mesmo topo. */
export function PageHeader({ title, subtitle, pilar, withCfp, actions }: Props) {
  return (
    <header className="page-h">
      <div className="page-h-txt">
        {pilar && <div className="page-h-pilar">{pilar}</div>}
        <h1 className="page-h-title">{title}</h1>
        {subtitle && <p className="page-h-sub">{subtitle}</p>}
        {withCfp && <div className="page-h-cfp"><CfpBadge /></div>}
      </div>
      {actions && <div className="page-h-actions">{actions}</div>}
    </header>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}
