'use client'
/* Hero — "areia da continuidade". Substitui a linha do ciclo (que virava um
   hexágono torto e poluía). Quando o passo ativo muda, a pill anterior se
   DESMANCHA e a areia VIAJA num arco (nod à espiral, sem reposicionar labels)
   até a próxima parada, onde a pill se reforma.

   Feito como um "cometa": a cabeça (partículas brilhantes, com glow e núcleo
   claro) sai primeiro e a cauda segue escalonada — assim lê como um movimento
   direcionado, e não some na poeira da transição de cena do WebGL. Só no desktop
   (os labels orbitais somem no mobile) → canvas escondido lá. Canvas 2D próprio,
   à parte do engine WebGL. Idle sem partículas = sem rAF. */
import React, { useRef, useEffect } from 'react'

type P = {
  fx: number; fy: number; tx: number; ty: number
  arc: number; delay: number; dur: number; size: number; lead: number; born: number
}

export function HeroSand({ leftPct, topPct, dark, active }: {
  leftPct: number; topPct: number; dark: boolean; active: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const parts = useRef<P[]>([])
  const raf = useRef(0)
  const prev = useRef<{ x: number; y: number } | null>(null)
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const darkRef = useRef(dark)
  darkRef.current = dark

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const measure = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size.current = { w: r.width, h: r.height, dpr }
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // dispara o "cometa" de areia quando a parada (leftPct/topPct) muda
  useEffect(() => {
    if (!active) return
    const { w, h } = size.current
    if (!w || !h) return
    const to = { x: (leftPct / 100) * w, y: (topPct / 100) * h }
    const from = prev.current
    prev.current = to
    if (!from) return // primeira revelação: só registra a parada, sem viagem
    // respeita quem pediu menos movimento: registra a parada mas não anima
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const now = performance.now()
    const dx = to.x - from.x, dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    const dir = dx >= 0 ? 1 : -1                // curva o arco pra fora
    const n = Math.max(14, Math.min(24, Math.round(dist / 18)))
    for (let i = 0; i < n; i++) {
      const lead = i / n                        // 0 = cabeça (brilhante, sai antes)
      const s = Math.random() - 0.5
      parts.current.push({
        fx: from.x + s * 10, fy: from.y + s * 10,
        tx: to.x + s * 8, ty: to.y + s * 8,
        arc: (44 + Math.abs(s) * 26) * dir,
        delay: lead * 230,                      // escalona → rastro de cometa
        dur: 640 + Math.random() * 160,
        size: 3.4 - lead * 1.9, lead, born: now,
      })
    }
    if (!raf.current) raf.current = requestAnimationFrame(loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPct, topPct, active])

  function loop() {
    const cv = ref.current
    if (!cv) { raf.current = 0; return }
    const ctx = cv.getContext('2d')
    if (!ctx) { raf.current = 0; return }
    const { dpr } = size.current
    const now = performance.now()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    const col = darkRef.current ? '199,184,250' : '106,78,200' // lavanda clara / accent
    const alive: P[] = []
    for (const p of parts.current) {
      const t = (now - p.born - p.delay) / p.dur
      if (t < 0) { alive.push(p); continue }
      if (t >= 1) continue
      const e = t * t * (3 - 2 * t)
      const bx = p.fx + (p.tx - p.fx) * e
      const by = p.fy + (p.ty - p.fy) * e
      const perp = Math.sin(e * Math.PI) * p.arc
      const dx = p.tx - p.fx, dy = p.ty - p.fy
      const len = Math.hypot(dx, dy) || 1
      const x = bx + (-dy / len) * perp
      const y = by + (dx / len) * perp
      const env = Math.sin(Math.min(1, t) * Math.PI)   // entra/some (a areia assenta)
      const a = env * (1 - p.lead * 0.45)              // cabeça mais opaca que a cauda
      // corpo com glow
      ctx.shadowBlur = 7
      ctx.shadowColor = `rgba(${col},${(a * 0.7).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(x, y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`
      ctx.fill()
      // núcleo claro → destaca da poeira ambiente
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(x, y, p.size * 0.42, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.55).toFixed(3)})`
      ctx.fill()
      alive.push(p)
    }
    ctx.shadowBlur = 0
    parts.current = alive
    if (alive.length) raf.current = requestAnimationFrame(loop)
    else { ctx.clearRect(0, 0, cv.width, cv.height); raf.current = 0 }
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  return <canvas ref={ref} className="h3d-sand" aria-hidden="true" />
}
