import { PageHeader, EmptyState } from '@/components/PageHeader'

export default function EvolucaoPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <PageHeader
        title="Evolução Registrada"
        subtitle={`Continuidade clínica · paciente ${params.id}`}
        withCfp
      />
      <EmptyState>Timeline de sessões assinadas + chat IA — Fase C.3.</EmptyState>
    </div>
  )
}
