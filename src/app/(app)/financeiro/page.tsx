import { PageHeader, EmptyState } from '@/components/PageHeader'

export default function FinanceiroPage() {
  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Cobranças, recebimentos e projeção." />
      <EmptyState>Listagem de cobranças e valor médio por sessão — Fase B/C.</EmptyState>
    </div>
  )
}
