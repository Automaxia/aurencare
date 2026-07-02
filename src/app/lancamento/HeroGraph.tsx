'use client'

import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'

/**
 * Visual do Hero — o DIFERENCIAL como protagonista: o grafo de temas vivo.
 * Nós respiram, pulsos viajam pelas conexões, e o tema "ativo" narra a análise
 * (frequência, co-ocorrência, evolução) — a inteligência clínica em movimento,
 * dentro da janela do produto.
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const ease = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c) }

type Node = { id: string; x: number; y: number; r: number; cor: string; ins: string }
const NODES: Node[] = [
  { id: 'ansiedade',  x: 200, y: 152, r: 30, cor: '#6a4ec8', ins: 'reaparece junto de “trabalho” · 8 sessões' },
  { id: 'cobrança',   x: 342, y: 80,  r: 22, cor: '#b07d40', ins: 'puxa autoestima — padrão recorrente' },
  { id: 'trabalho',   x: 104, y: 66,  r: 20, cor: '#5a9e8a', ins: 'gatilho que volta há 3 sessões' },
  { id: 'autoestima', x: 336, y: 226, r: 20, cor: '#b07d40', ins: 'objetivo evoluiu +18%' },
  { id: 'sono',       x: 120, y: 240, r: 16, cor: '#5a9e8a', ins: 'sumiu nas últimas 5 sessões' },
  { id: 'mãe',        x: 44,  y: 160, r: 16, cor: '#c4607a', ins: 'citada em 12 sessões' },
  { id: 'sumir',      x: 278, y: 38,  r: 14, cor: '#6a4ec8', ins: 'voltou após 6 semanas' },
]
const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 4], [0, 6], [0, 5], [1, 3], [5, 3], [2, 1]]

export function HeroGraph() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setT(3); return }
    let raf = 0
    const tick = (now: number) => { setT(now / 1000); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const active = Math.floor(t / 2.8) % NODES.length
  const an = NODES[active]
  const isLit = (i: number) => i === active || EDGES.some(([a, b]) => (a === active && b === i) || (b === active && a === i))

  return (
    <div className="hg">
      <div className="hg-bar">
        <span className="hg-dot" /><span className="hg-dot" /><span className="hg-dot" />
        <span className="hg-url"><Logo size={15} /> linha do tempo clínica · Marina K.</span>
      </div>

      <div className="hg-canvas">
        <svg viewBox="0 0 440 300" className="hg-svg" fill="none">
          {EDGES.map(([a, b], i) => {
            const na = NODES[a], nb = NODES[b]
            const lit = active === a || active === b
            const tr = (t * 0.5 + i * 0.31) % 1
            return (
              <g key={i}>
                <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? na.cor : '#6a4ec8'} strokeOpacity={lit ? 0.5 : 0.13} strokeWidth={lit ? 1.8 : 1.2} strokeLinecap="round" />
                {lit && <circle cx={lerp(na.x, nb.x, tr)} cy={lerp(na.y, nb.y, tr)} r={2.6} fill={na.cor} opacity={0.9} />}
              </g>
            )
          })}
          {NODES.map((n, i) => {
            const fl = Math.sin(t * 0.5 + i * 1.3) * 2.6
            const isA = active === i
            const dim = !isLit(i)
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y + fl})`} style={{ opacity: dim ? 0.4 : 1, transition: 'opacity .5s' }}>
                {isA && <circle r={n.r + 8} fill="none" stroke={n.cor} strokeWidth={1.2} strokeOpacity={0.4 + 0.28 * Math.sin(t * 3)} />}
                <circle r={n.r + 6} fill={n.cor} opacity={0.12} />
                <circle r={n.r} fill={n.cor} fillOpacity={isA ? 0.95 : 0.82} />
                <text y={n.r + 13} textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--font-display), serif" fontWeight={isA ? 600 : 400}>{n.id}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="hg-read" key={active}>
        <span className="hg-read-dot" style={{ background: an.cor }} />
        <span className="hg-read-tx"><strong>{an.id}</strong> {an.ins}</span>
      </div>

      <div className="hg-foot">
        <span>14 sessões · 4 meses</span>
        <span className="hg-foot-live"><i />conectado sozinho</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hg { background:var(--card); border:1px solid var(--border); border-radius:18px; overflow:hidden;
          box-shadow:0 40px 90px -30px rgba(41,24,96,.34), 0 8px 30px rgba(26,24,37,.06);
          animation:hgRise .8s var(--ease) both; }
        .hg-bar { display:flex; align-items:center; gap:7px; padding:11px 14px; background:var(--surface); border-bottom:1px solid var(--border); }
        .hg-dot { width:9px; height:9px; border-radius:50%; background:var(--faint); opacity:.5; }
        .hg-url { margin-left:10px; display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--muted); }
        .hg-canvas { position:relative; padding:8px 10px 0;
          background:
            radial-gradient(ellipse 46% 42% at 46% 52%, rgba(106,78,200,.06), transparent 70%),
            radial-gradient(ellipse 40% 40% at 78% 74%, rgba(90,158,138,.055), transparent 72%); }
        .hg-svg { width:100%; height:auto; display:block; overflow:visible; }
        .hg-read { display:flex; align-items:center; gap:9px; margin:6px 16px 0; padding:10px 12px; border-radius:11px;
          background:var(--surface); border:1px solid var(--border); animation:hgFade .5s var(--ease); }
        .hg-read-dot { width:9px; height:9px; border-radius:50%; flex:none; }
        .hg-read-tx { font-size:13px; color:var(--ink-soft); line-height:1.35; }
        .hg-read-tx strong { color:var(--ink); font-weight:600; text-transform:capitalize; }
        .hg-foot { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 15px; font-size:11.5px; color:var(--muted); }
        .hg-foot-live { display:inline-flex; align-items:center; gap:6px; color:var(--sage); font-weight:500; }
        .hg-foot-live i { width:6px; height:6px; border-radius:50%; background:var(--sage); animation:hgBlink 1.6s infinite; }
        @keyframes hgRise { from{ opacity:0; transform:translateY(22px) scale(.985); } to{ opacity:1; transform:none; } }
        @keyframes hgFade { from{ opacity:0; transform:translateY(5px); } to{ opacity:1; transform:none; } }
        @keyframes hgBlink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
        @media (prefers-reduced-motion: reduce) { .hg, .hg-read, .hg-foot-live i { animation:none !important; } }
      ` }} />
    </div>
  )
}
