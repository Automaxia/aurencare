import { PageHeader } from '@/components/PageHeader'

export default function InicioPage() {
  return (
    <div>
      <PageHeader
        title="Início"
        subtitle="Foco imediato, continuidade e inteligência silenciosa."
      />
      <div className="empty">
        Dashboard com hierarquia de 3 níveis (Foco · Continuidade · Inteligência) — implementação na Fase B.
      </div>
    </div>
  )
}
