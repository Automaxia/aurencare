import { PageHeader, EmptyState } from '@/components/PageHeader'

export default function ObjetivosPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <PageHeader
        title="Objetivos e Progresso"
        subtitle={`Paciente ${params.id}`}
        withCfp
      />
      <EmptyState>CRUD de objetivos + visualização de progresso — Fase C.4.</EmptyState>
    </div>
  )
}
