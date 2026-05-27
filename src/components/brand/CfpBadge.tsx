/**
 * CFP badge obrigatório em toda tela com conteúdo de IA. §2 + §9.
 */
export function CfpBadge({ className }: { className?: string }) {
  return (
    <div className={`cfp-badge ${className ?? ''}`} role="note">
      <span aria-hidden="true">🧭</span>
      <span>
        Apoio à reflexão · não substitui avaliação clínica · CFP 09/2024
      </span>
    </div>
  )
}
