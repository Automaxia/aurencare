import { PageHeader, EmptyState } from '@/components/PageHeader'
import Link from 'next/link'

export default function AgendaPage() {
  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Dia · semana · mês."
        actions={<Link className="btn primary" href="/agenda/nova">+ Nova sessão</Link>}
      />
      <EmptyState>Timeline e calendário — Fase B.2.</EmptyState>
    </div>
  )
}
