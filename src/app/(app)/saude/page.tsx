import { PageHeader, EmptyState } from '@/components/PageHeader'

export default function SaudePage() {
  return (
    <div>
      <PageHeader title="Saúde da Prática" subtitle="KPIs silenciosos da sua prática." />
      <EmptyState>Indicadores: comparecimento, valor médio por sessão, retenção — Fase C.5.</EmptyState>
    </div>
  )
}
