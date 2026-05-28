import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerSaude } from '@/server/services/financeiro'
import { formatBRL } from '@/lib/formatters'
import { SaudeInsights } from './insights'

export const dynamic = 'force-dynamic'

export default async function SaudePage() {
  const user = await requirePsicologo()
  const s = await lerSaude(user.id)

  return (
    <div>
      <PageHeader
        title="Saúde da Prática"
        subtitle="Como a sua prática está esta semana."
      />

      {/* KPIs com formulação corrigida */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Kpi label="Sessões esta semana" value={s.sessoesSemana} />
        <Kpi label="Sessões este mês"    value={s.sessoesMes} />
        <Kpi label="Pacientes ativos"    value={s.pacientesAtivos} />
        <Kpi label="Valor médio por sessão" value={formatBRL(s.ticketMedio)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiBig
          label="Taxa de comparecimento"
          value={`${s.taxaComparecimentoPct.toFixed(0)}%`}
          color={s.taxaComparecimentoPct >= 80 ? 'sage' : s.taxaComparecimentoPct < 60 ? 'rose' : 'amber'}
          hint={`${s.sessoesConcluidas90d} de ${s.sessoesPassadas90d} sessões dos últimos 90 dias`}
        />
        <KpiBig
          label="Faltas + cancelamentos"
          value={`${s.taxaCancelamentoPct.toFixed(0)}%`}
          color={s.taxaCancelamentoPct < 15 ? 'sage' : s.taxaCancelamentoPct > 25 ? 'rose' : 'amber'}
          hint={`${s.noShows90d} sem comparecimento · ${s.cancelamentos90d} cancelamentos (90d)`}
        />
        <KpiBig
          label="Retenção (30 dias)"
          value={`${s.retencaoPct.toFixed(0)}%`}
          color={s.retencaoPct >= 70 ? 'sage' : s.retencaoPct < 50 ? 'amber' : undefined}
          hint={`${s.pacientesComRecente30d} de ${s.pacientesAtivos} pacientes ativos tiveram sessão`}
        />
      </div>

      {/* Insights amigáveis da IA */}
      <SaudeInsights />
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string | number; color?: 'sage' | 'amber' | 'rose' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
    </div>
  )
}

function KpiBig({ label, value, color, hint }: { label: string; value: string; color?: 'sage' | 'amber' | 'rose'; hint?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 36, lineHeight: 1, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}
