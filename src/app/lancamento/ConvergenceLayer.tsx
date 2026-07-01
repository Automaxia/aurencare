'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Bloco 2 da "plataforma" — a diferenciação. Todos os módulos do consultório
 * convergem, com pulsos animados, para uma camada superior: Inteligência Clínica
 * Longitudinal → Continuidade terapêutica. Sem comparação negativa: mostra a
 * evolução natural (registrar → conectar → continuidade). Anima só na viewport.
 */

const MODS = ['Agenda', 'Sessões', 'Transcrição', 'Prontuário', 'Objetivos', 'Financeiro', 'WhatsApp']

function useInView(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVis(e.isIntersecting), { threshold: 0, rootMargin: '0px 0px -10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, vis]
}
function useRaf(active: boolean): number {
  const [t, setT] = useState(0)
  const raf = useRef(0)
  const base = useRef<number | null>(null)
  const acc = useRef(0)
  useEffect(() => {
    if (!active) { base.current = null; return }
    const tick = (now: number) => { if (base.current == null) base.current = now; setT(acc.current + (now - base.current) / 1000); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf.current); if (base.current != null) acc.current += (performance.now() - base.current) / 1000; base.current = null }
  }, [active])
  return t
}

const W = 780, H = 340
const NODE = { x: 500, y: 120, w: 262, h: 108 }
const nodeLeft = { x: NODE.x, y: NODE.y + NODE.h / 2 }
const bez = (p0: [number, number], p1: [number, number], p2: [number, number], u: number): [number, number] => {
  const m = 1 - u
  return [m * m * p0[0] + 2 * m * u * p1[0] + u * u * p2[0], m * m * p0[1] + 2 * m * u * p1[1] + u * u * p2[1]]
}

export function ConvergenceLayer() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)

  const rows = MODS.map((m, i) => {
    const cy = 26 + (i / (MODS.length - 1)) * (H - 52)
    const p0: [number, number] = [176, cy]
    const p1: [number, number] = [356, nodeLeft.y]
    const p2: [number, number] = [nodeLeft.x, nodeLeft.y]
    return { m, cy, p0, p1, p2 }
  })
  // brilho do nó quando um pulso "chega"
  const arrivals = rows.map((_, i) => (t * 0.32 + i * 0.13) % 1)
  const glow = Math.max(0, ...arrivals.map(u => (u > 0.9 ? (u - 0.9) / 0.1 : 0)))

  return (
    <div ref={ref} className="conv-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="conv-svg" role="img"
        aria-label="Todos os módulos do consultório — agenda, sessões, transcrição, prontuário, objetivos, financeiro, WhatsApp — convergem para uma camada de Inteligência Clínica Longitudinal, que gera continuidade terapêutica.">
        <defs>
          <linearGradient id="convNode" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6a4ec8" />
            <stop offset="1" stopColor="#5a9e8a" />
          </linearGradient>
        </defs>

        {/* conectores */}
        {rows.map((r, i) => (
          <path key={i} d={`M ${r.p0[0]} ${r.p0[1]} Q ${r.p1[0]} ${r.p1[1]} ${r.p2[0]} ${r.p2[1]}`}
            fill="none" stroke="var(--accent)" strokeOpacity="0.16" strokeWidth="1.2" />
        ))}

        {/* módulos (pílulas) */}
        {rows.map((r, i) => (
          <g key={i}>
            <rect x={18} y={r.cy - 15} width={158} height={30} rx={9} fill="var(--card)" stroke="var(--border)" />
            <circle cx={34} cy={r.cy} r={3.2} fill="var(--accent)" opacity="0.7" />
            <text x={46} y={r.cy + 4} fontSize="12.5" fill="var(--ink-soft)" fontFamily="var(--font-body, inherit)">{r.m}</text>
          </g>
        ))}

        {/* pulsos viajando p/ o nó */}
        {rows.map((r, i) => {
          const u = arrivals[i]
          const [px, py] = bez(r.p0, r.p1, r.p2, u)
          return <circle key={i} cx={px} cy={py} r={2.6} fill={i % 2 ? 'var(--sage)' : 'var(--accent)'} opacity={0.85 * (1 - Math.max(0, (u - 0.92) / 0.08))} />
        })}

        {/* nó — Inteligência Clínica Longitudinal */}
        <g>
          <rect x={NODE.x} y={NODE.y - 4 * glow} width={NODE.w} height={NODE.h} rx={16} fill="url(#convNode)"
            style={{ filter: `drop-shadow(0 16px 34px rgba(106,78,200,${0.24 + glow * 0.14}))` }} />
          <text x={NODE.x + NODE.w / 2} y={NODE.y + 40} textAnchor="middle" fontSize="19" fontWeight={500} fill="#fff" fontFamily="var(--font-display), serif">Inteligência Clínica</text>
          <text x={NODE.x + NODE.w / 2} y={NODE.y + 63} textAnchor="middle" fontSize="19" fontWeight={500} fill="#fff" fontFamily="var(--font-display), serif">Longitudinal</text>
          <text x={NODE.x + NODE.w / 2} y={NODE.y + 86} textAnchor="middle" fontSize="11.5" fill="rgba(255,255,255,.8)">memória que acompanha todo o tratamento</text>
        </g>

        {/* fluxo p/ continuidade */}
        <line x1={NODE.x + NODE.w / 2} y1={NODE.y + NODE.h} x2={NODE.x + NODE.w / 2} y2={NODE.y + NODE.h + 26} stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1.4" />
        <polygon points={`${NODE.x + NODE.w / 2 - 4},${NODE.y + NODE.h + 22} ${NODE.x + NODE.w / 2 + 4},${NODE.y + NODE.h + 22} ${NODE.x + NODE.w / 2},${NODE.y + NODE.h + 28}`} fill="var(--accent)" opacity="0.55" />
        <g>
          <rect x={NODE.x + NODE.w / 2 - 108} y={NODE.y + NODE.h + 30} width={216} height={34} rx={17}
            fill="color-mix(in srgb, var(--accent) 8%, var(--card))" stroke="color-mix(in srgb, var(--accent) 28%, transparent)" />
          <text x={NODE.x + NODE.w / 2} y={NODE.y + NODE.h + 52} textAnchor="middle" fontSize="13.5" fontWeight={600} fill="#391d96" fontFamily="var(--font-display), serif">Continuidade terapêutica</text>
        </g>
      </svg>
      <style dangerouslySetInnerHTML={{ __html: `
        .conv-wrap { margin-top:32px; }
        .conv-svg { width:100%; height:auto; display:block; max-width:820px; margin:0 auto; }
      ` }} />
    </div>
  )
}
