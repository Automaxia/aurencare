import { PageHeader, EmptyState } from '@/components/PageHeader'
import Link from 'next/link'

export default function PacientesPage() {
  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Quem você está acompanhando agora."
        actions={<Link className="btn primary" href="/pacientes/novo">+ Novo paciente</Link>}
      />
      <EmptyState>Lista, filtros e badges automáticos — Fase B.1.</EmptyState>
    </div>
  )
}
