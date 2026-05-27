import { PageHeader, EmptyState } from '@/components/PageHeader'

export default function NovaSessaoPage() {
  return (
    <div>
      <PageHeader title="Nova sessão" subtitle="Paciente · data/hora · modalidade." />
      <EmptyState>Formulário + disparo do Fluxo 2 (método de pagamento) — Fase B.2/B.3.</EmptyState>
    </div>
  )
}
