'use client'
/* Hero — camada de ambiência: grafo de partículas em canvas 2D (nós que se
   conectam = a metáfora de continuidade/memória do produto). Leve e robusto:
   ~40-60 nós, pausa fora da tela, respeita prefers-reduced-motion, degrada
   graciosamente sem canvas. Substitui o hero 3D WebGL do handoff pela mesma
   ideia visual com fração do peso/risco (P5). */
import React, { useRef, useEffect } from 'react'

type P = { x: number; y: number; vx: number; vy: number; r: number; sage: boolean }

export function HeroAmbient() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    let pts: P[] = []
    let raf = 0
    let running = true

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    function build() {
      const parent = cv!.parentElement!
      W = parent.clientWidth; H = parent.clientHeight
      cv!.width = W * dpr; cv!.height = H * dpr
      cv!.style.width = W + 'px'; cv!.style.height = H + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // densidade proporcional à área, com teto (performance)
      const n = Math.min(58, Math.max(22, Math.round((W * H) / 26000)))
      pts = Array.from({ length: n }, () => ({
        x: rand(0, W), y: rand(0, H),
        vx: rand(-0.14, 0.14), vy: rand(-0.14, 0.14),
        r: rand(1.1, 2.6), sage: Math.random() < 0.18,
      }))
    }

    const LINK = 168 // distância máx. p/ desenhar aresta

    function frame() {
      if (!running) return
      ctx!.clearRect(0, 0, W, H)
      // arestas
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.16
            ctx!.strokeStyle = `rgba(106,78,200,${o})`
            ctx!.lineWidth = 1
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke()
          }
        }
      }
      // nós
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20
        }
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = p.sage ? 'rgba(90,158,138,.55)' : 'rgba(106,78,200,.5)'
        ctx!.fill()
      }
      if (!reduce) raf = requestAnimationFrame(frame)
    }

    build()
    frame() // primeira pintura (static se reduce)

    // pausa quando o hero sai da tela (economia)
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting
      if (running && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame) }
      else cancelAnimationFrame(raf)
    }, { threshold: 0 })
    io.observe(cv.parentElement!)

    let rt: any
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) frame() }, 160) }
    window.addEventListener('resize', onResize)

    return () => {
      running = false; cancelAnimationFrame(raf)
      io.disconnect(); window.removeEventListener('resize', onResize); clearTimeout(rt)
    }
  }, [])

  return <canvas ref={ref} className="hero-ambient-canvas" aria-hidden="true" />
}
