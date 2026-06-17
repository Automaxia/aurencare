import { Compass } from 'lucide-react'

/**
 * CFP badge obrigatório em toda tela com conteúdo de IA. §2 + §9.
 */
export function CfpBadge({ className }: { className?: string }) {
  return (
    <div className={`cfp-badge ${className ?? ''}`} role="note">
      <Compass size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span>
        Apoio à reflexão · não substitui avaliação clínica · CFP 09/2024
      </span>
    </div>
  )
}
