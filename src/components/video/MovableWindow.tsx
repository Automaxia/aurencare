'use client'

import { useRef, useState } from 'react'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))

/**
 * Janela flutuante arrastável pela tela inteira (não só conteúdo interno). Uma alça
 * no topo move toda a janela; o conteúdo (ex: VideoCall) fica abaixo, intacto.
 * Posição inicial no canto inferior direito; vira left/top ao arrastar.
 */
export function MovableWindow({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const drag = useRef<{ sx: number; sy: number; bl: number; bt: number } | null>(null)
  const winRef = useRef<HTMLDivElement>(null)

  function down(e: React.PointerEvent) {
    const el = winRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, bl: r.left, bt: r.top }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
  }
  function move(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const left = clamp(d.bl + (e.clientX - d.sx), 4, window.innerWidth - width - 4)
    const top = clamp(d.bt + (e.clientY - d.sy), 4, window.innerHeight - height - 4)
    setPos({ left, top })
  }
  function up(e: React.PointerEvent) {
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
  }

  const place: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top }
    : { right: 20, bottom: 20 }

  return (
    <div
      ref={winRef}
      style={{
        position: 'fixed', width, height, zIndex: 40, ...place,
        boxShadow: 'var(--sh-lg)', borderRadius: 'var(--rsm)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', background: '#0e0c18',
      }}
    >
      <div
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        title="Arraste para mover a janela"
        style={{
          height: 22, flex: 'none', cursor: 'grab', touchAction: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(20,16,38,.55)', backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ width: 30, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.4)' }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
    </div>
  )
}
