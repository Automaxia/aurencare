'use client'
/* Hero 3D — monta o engine de partículas Three.js (portado do handoff) como
   camada de ambiência atrás do conteúdo do hero. O PAI (Hero) dirige o fluxo de
   cenas via `sceneKey`; aqui só chamamos engine.goTo quando ela muda. Detecta
   WebGL + reduced-motion + mobile; sem suporte, cai no HeroAmbient (canvas 2D).
   Qualquer erro no engine também cai no fallback — a landing nunca quebra. */
import React, { useRef, useState, useEffect } from 'react'
import { HeroAmbient } from './hero-ambient'

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function Hero3D({ sceneKey }: { sceneKey: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)
  const [fallback, setFallback] = useState<boolean | null>(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia?.('(max-width: 760px)').matches
    if (reduce || small || !webglOk()) { setFallback(true); return }

    let cancelled = false
    ;(async () => {
      try {
        const [{ mount }, { SCENES }] = await Promise.all([
          import('./hero3d/engine'),
          import('./hero3d/scenes'),
        ])
        if (cancelled || !stageRef.current || !SCENES) { setFallback(true); return }
        apiRef.current = mount(stageRef.current, SCENES, {})
        setFallback(false)
      } catch (err) {
        console.error('[hero3d] falhou — usando fallback canvas', err)
        setFallback(true)
      }
    })()

    return () => {
      cancelled = true
      try { apiRef.current?.dispose?.() } catch {}
      apiRef.current = null
    }
  }, [])

  // segue o fluxo de cenas dirigido pelo pai
  useEffect(() => {
    if (fallback === false && apiRef.current?.goTo && sceneKey) {
      try { apiRef.current.goTo(sceneKey) } catch {}
    }
  }, [sceneKey, fallback])

  return (
    <>
      <div ref={stageRef} className="hero3d-stage" aria-hidden="true" style={{ opacity: fallback === false ? 1 : 0 }} />
      {fallback !== false && <HeroAmbient />}
    </>
  )
}
