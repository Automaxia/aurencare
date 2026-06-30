'use client'

import { useRef, useState } from 'react'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))

/**
 * Janela flutuante arrastável pela tela inteira (não só conteúdo interno). Uma alça
 * no topo move toda a janela; o conteúdo (ex: VideoCall) fica abaixo, intacto.
 * Posição inicial no canto inferior direito; vira left/top ao arrastar.
 */
export function MovableWindow({ width, height, minimized, children }: { width: number; height: number; minimized?: boolean; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [size, setSize] = useState({ w: width, h: height })
  const drag = useRef<{ sx: number; sy: number; bl: number; bt: number } | null>(null)
  const resz = useRef<{ sx: number; sy: number; bw: number; bh: number } | null>(null)
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
    const left = clamp(d.bl + (e.clientX - d.sx), 4, window.innerWidth - size.w - 4)
    const top = clamp(d.bt + (e.clientY - d.sy), 4, window.innerHeight - size.h - 4)
    setPos({ left, top })
  }
  function up(e: React.PointerEvent) {
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
  }

  // Redimensionar pela alça do canto inferior direito (livre, com mín/máx).
  function downResize(e: React.PointerEvent) {
    e.stopPropagation()
    resz.current = { sx: e.clientX, sy: e.clientY, bw: size.w, bh: size.h }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
  }
  function moveResize(e: React.PointerEvent) {
    const r = resz.current
    if (!r) return
    const w = clamp(r.bw + (e.clientX - r.sx), 240, Math.round(window.innerWidth * 0.95))
    const h = clamp(r.bh + (e.clientY - r.sy), 150, Math.round(window.innerHeight * 0.92))
    setSize({ w, h })
  }
  function upResize(e: React.PointerEvent) {
    resz.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
  }

  const place: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top }
    : { right: 20, bottom: 20 }

  // Minimizado: o próprio VideoCall (.vc-min) já se posiciona fixo no canto.
  // Não renderizamos a janela (caixa + alça) pra não sobrar uma caixa preta
  // vazia no lugar original.
  if (minimized) return <>{children}</>

  return (
    <div
      ref={winRef}
      style={{
        position: 'fixed', width: size.w, height: size.h, zIndex: 40, ...place,
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

      {/* Alça de redimensionar (canto inferior direito) */}
      <div
        onPointerDown={downResize} onPointerMove={moveResize} onPointerUp={upResize}
        title="Arraste para redimensionar"
        style={{
          position: 'absolute', right: 0, bottom: 0, width: 18, height: 18,
          cursor: 'nwse-resize', touchAction: 'none', zIndex: 2,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 3,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M9 1 L1 9 M9 5 L5 9" stroke="rgba(255,255,255,.55)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  )
}
