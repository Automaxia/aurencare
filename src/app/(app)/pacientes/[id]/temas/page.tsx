import { PageHeader } from '@/components/PageHeader'

export default function TemasPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <PageHeader
        title="Temas Recorrentes"
        subtitle={`Mapa de correlações · paciente ${params.id}`}
        withCfp
      />
      <div className="graph-stage" style={{ display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.4)' }}>
        Grafo force-directed — Fase C.1.
      </div>
    </div>
  )
}
