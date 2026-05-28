/**
 * Handle de arrastar — 6 dots SVG. §7 mockup v12.5.
 * Substitui o caractere "⠿" antigo.
 */
export function WidgetGrip({ size = 13 }: { size?: number }) {
  return (
    <div className="widget-grip" title="Arraste para reorganizar">
      <svg viewBox="0 0 10 16" width={Math.round(size * 9 / 13)} height={size} fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="3" r="1.2" />
        <circle cx="2" cy="8" r="1.2" />
        <circle cx="2" cy="13" r="1.2" />
        <circle cx="8" cy="3" r="1.2" />
        <circle cx="8" cy="8" r="1.2" />
        <circle cx="8" cy="13" r="1.2" />
      </svg>
    </div>
  )
}
