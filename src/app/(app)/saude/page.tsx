import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerSaude } from '@/server/services/financeiro'
import { formatBRL } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function SaudePage() {
  const user = await requirePsicologo()
  const s = await lerSaude(user.id)

  return (
    <div>
      <PageHeader title="Saúde da Prática" subtitle="KPIs silenciosos da sua prática." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Kpi label="Sessões na semana" value={s.sessoesSemana} />
        <Kpi label="Sessões no mês"    value={s.sessoesMes} />
        <Kpi label="Pacientes ativos"  value={s.pacientesAtivos} />
        <Kpi label="Taxa de comparecimento" value={`${s.taxaComparecimentoPct.toFixed(0)}%`} color={s.taxaComparecimentoPct < 70 ? 'rose' : 'sage'} />
        <Kpi label="Sem comparecimento + cancelamento" value={`${s.taxaCancelamentoPct.toFixed(0)}%`} color={s.taxaCancelamentoPct > 20 ? 'rose' : undefined} />
        <Kpi label="Retenção 30d" value={`${s.retencaoPct.toFixed(0)}%`} color={s.retencaoPct < 60 ? 'amber' : 'sage'} />
        <Kpi label="Valor médio por sessão" value={formatBRL(s.ticketMedio)} />
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string | number; color?: 'sage' | 'amber' | 'rose' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
    </div>
  )
}
