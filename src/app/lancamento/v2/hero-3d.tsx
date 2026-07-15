'use client'
/* Hero 3D — monta o engine de partículas Three.js (portado do handoff) e, sobre
   ele, a camada de overlay HTML (âncoras projetadas em 3D + cards + ticker +
   dashboard). O PAI (Hero) dirige o fluxo de cenas via `seqKey`; aqui chamamos
   engine.goTo quando muda e alimentamos os overlays com a cena ativa.
   Detecta WebGL + reduced-motion; sem suporte, cai no HeroAmbient (canvas 2D) —
   a landing nunca quebra. Full-bleed: o stage e a camada de âncoras ocupam o
   header inteiro (inset:0), então a projeção 3D→tela das âncoras fica alinhada. */
import React, { useRef, useState, useEffect } from 'react'
import { HeroAmbient } from './hero-ambient'
import { H3DAnchors, TemasQuoteTicker, ObjDashboard } from './hero-anchors'

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function Hero3D({ seqKey }: { seqKey: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const anchorsHostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)
  const [fallback, setFallback] = useState<boolean | null>(null)
  const [scenes, setScenes] = useState<any>(null)

  useEffect(() => {
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
        apiRef.current = mount(stageRef.current, SCENES)
        setScenes(SCENES)
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

  // liga as âncoras HTML ao engine assim que ele e o DOM das âncoras existem
  useEffect(() => {
    if (fallback !== false || !scenes || !apiRef.current?.attachAnchors || !anchorsHostRef.current) return
    try { apiRef.current.attachAnchors(anchorsHostRef.current) } catch {}
  }, [fallback, scenes])

  // segue o fluxo de cenas dirigido pelo pai. O engine REJEITA goTo enquanto uma
  // transição está em curso (retorna false) — se só chamássemos uma vez, o 3D
  // ficaria travado na cena anterior enquanto o estado React já avançou (copy e
  // engine dessincronizados). Então tentamos de novo até o engine aceitar, sempre
  // mirando o seqKey atual — converge dentro da duração da transição.
  useEffect(() => {
    if (fallback !== false || !apiRef.current?.goTo || !seqKey) return
    let tries = 0, timer: any
    const attempt = () => {
      let ok = false
      try { ok = !!apiRef.current?.goTo?.(seqKey) } catch {}
      if (!ok && tries++ < 40) timer = setTimeout(attempt, 250)
    }
    attempt()
    return () => clearTimeout(timer)
  }, [seqKey, fallback])

  const live = fallback === false

  return (
    <>
      <div ref={stageRef} className="hero3d-stage" aria-hidden="true" style={{ opacity: live ? 1 : 0 }} />
      {fallback !== false && <HeroAmbient />}
      {live && (
        <>
          <div ref={anchorsHostRef}>{scenes && <H3DAnchors scenes={scenes} />}</div>
          <TemasQuoteTicker scenes={scenes} active={live && seqKey === 'temas'} />
          <ObjDashboard active={live && seqKey === 'objetivos'} />
        </>
      )}
    </>
  )
}
