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
    // 3D habilitado também no mobile (o layout empilhado do design espera as cenas
    // de cada fase). Só cai no fallback se não houver WebGL ou movimento reduzido.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !webglOk()) { setFallback(true); return }

    let cancelled = false
    ;(async () => {
      try {
        const [{ mount }, { SCENES }] = await Promise.all([
          import('./hero3d/engine'),
          import('./hero3d/scenes'),
        ])
        if (cancelled || !stageRef.current || !SCENES) { setFallback(true); return }
        // mobile → modo claro forçado (todas as cenas claras, cada uma com sua forma)
        const mobile = window.matchMedia?.('(max-width: 1100px)').matches
        apiRef.current = mount(stageRef.current, SCENES, { light: !!mobile })
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

  // segue o fluxo de cenas dirigido pelo pai. Cada fase mantém a SUA cena; no
  // mobile o engine já renderiza tudo claro (opts.light no mount), então não há
  // remap — Conectar/Evoluir/Videochamada mantêm as próprias formas, distintas.
  useEffect(() => {
    if (fallback !== false || !apiRef.current?.goTo || !sceneKey) return
    try { apiRef.current.goTo(sceneKey) } catch {}
  }, [sceneKey, fallback])

  return (
    <>
      <div ref={stageRef} className="hero3d-stage" aria-hidden="true" style={{ opacity: fallback === false ? 1 : 0 }} />
      {fallback !== false && <HeroAmbient />}
    </>
  )
}
