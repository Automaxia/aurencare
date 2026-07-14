'use client'
/* Hero 3D — monta o engine de partículas Three.js (portado do handoff) como
   camada de ambiência atrás do conteúdo do hero, ciclando pelas cenas. Detecta
   WebGL + prefers-reduced-motion; sem suporte, cai no HeroAmbient (canvas 2D).
   Qualquer erro no engine também cai no fallback — a landing nunca quebra. */
import React, { useRef, useState, useEffect } from 'react'
import { HeroAmbient } from './hero-ambient'

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function Hero3D() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState<boolean | null>(null) // null = decidindo

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // mobile pequeno: o cinematográfico projetado é frágil → canvas leve
    const small = window.matchMedia?.('(max-width: 760px)').matches
    if (reduce || small || !webglOk()) { setFallback(true); return }

    let api: any = null
    let cyc: any = null
    let cancelled = false
    ;(async () => {
      try {
        const [{ mount }, { SCENES }] = await Promise.all([
          import('./hero3d/engine'),
          import('./hero3d/scenes'),
        ])
        if (cancelled || !stageRef.current || !SCENES) { setFallback(true); return }
        api = mount(stageRef.current, SCENES, {})
        setFallback(false)
        // cicla pelas cenas (o engine roda seu próprio RAF; goTo faz o morph)
        const order: string[] = SCENES.order || []
        let i = 0
        if (order.length && api?.goTo) {
          cyc = setInterval(() => { i = (i + 1) % order.length; try { api.goTo(order[i]) } catch {} }, 5000)
        }
      } catch (err) {
        console.error('[hero3d] falhou — usando fallback canvas', err)
        setFallback(true)
      }
    })()

    return () => {
      cancelled = true
      if (cyc) clearInterval(cyc)
      try { api?.dispose?.() } catch {}
    }
  }, [])

  return (
    <>
      {/* stage do WebGL (preenchido pelo engine) */}
      <div ref={stageRef} className="hero3d-stage" aria-hidden="true" style={{ opacity: fallback === false ? 1 : 0 }} />
      {/* fallback canvas 2D enquanto decide ou se não há WebGL */}
      {fallback !== false && <HeroAmbient />}
    </>
  )
}
