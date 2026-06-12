'use client'

import { createContext, useContext } from 'react'

/**
 * Handle de arrastar — 6 dots SVG. §7 mockup v12.5.
 * O drag do dnd-kit é injetado SÓ aqui (via DragHandleContext): o widget só move
 * arrastando o grip (canto superior direito) — não clicando em qualquer lugar —
 * e a barra de espaço volta a funcionar nas caixas de texto dentro do widget.
 */

type Handle = {
  attributes?: Record<string, any>
  listeners?: Record<string, any>
  setRef?: (el: HTMLElement | null) => void
}

export const DragHandleContext = createContext<Handle | null>(null)

export function WidgetGrip({ size = 13 }: { size?: number }) {
  const h = useContext(DragHandleContext)
  return (
    <div
      className="widget-grip"
      ref={h?.setRef}
      {...(h?.attributes ?? {})}
      {...(h?.listeners ?? {})}
      title="Arraste pelo grip para reorganizar"
      style={{ touchAction: 'none' }}
    >
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
