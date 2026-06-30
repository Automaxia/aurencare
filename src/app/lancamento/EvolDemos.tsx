'use client'

import { useEffect, useRef, useState } from 'react'

/** Animações das seções de conteúdo (grafo vivo + objetivos/evolução).
 *  RAF só roda quando a seção está visível (useInView). */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c) }
const lerp = (a: number, b: number, f: number) => a + (b - a) * f

function useInView(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVis(e.isIntersecting), { threshold: 0, rootMargin: '0px 0px -12% 0px' })
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
    const tick = (now: number) => {
      if (base.current == null) base.current = now
      setT(acc.current + (now - base.current) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf.current); if (base.current != null) acc.current += (performance.now() - base.current) / 1000; base.current = null }
  }, [active])
  return t
}

// ── Grafo vivo (seção de continuidade) ──────────────────────────────────
const GNODES = [
  { id: 'ansiedade', x: 152, y: 112, r: 27, cor: '#6a4ec8' },
  { id: 'cobrança', x: 256, y: 64, r: 20, cor: '#b07d40' },
  { id: 'trabalho', x: 84, y: 48, r: 18, cor: '#5a9e8a' },
  { id: 'autoestima', x: 252, y: 170, r: 18, cor: '#b07d40' },
  { id: 'sono', x: 92, y: 182, r: 15, cor: '#5a9e8a' },
  { id: 'mãe', x: 36, y: 122, r: 14, cor: '#c4607a' },
  { id: 'sumir', x: 210, y: 26, r: 12, cor: '#6a4ec8' },
]
const GEDGES: [number, number, number][] = [
  [0, 1, .7], [0, 2, .5], [0, 4, .45], [0, 6, .4], [0, 5, .35], [1, 3, .6], [5, 3, .55], [2, 1, .4],
]

export function AnimatedGrafo() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  const active = Math.floor(t / 2.6) % GNODES.length
  const isLit = (i: number) => i === active || GEDGES.some(([a, b]) => (a === active && b === i) || (b === active && a === i))
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <div style={{ fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--font-mono), monospace', marginBottom: 12 }}>
        Grafo de temas · Marina · 14 sessões
      </div>
      <svg viewBox="0 0 340 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
        {GEDGES.map(([a, b, w], i) => {
          const na = GNODES[a], nb = GNODES[b]
          const lit = active === a || active === b
          const tr = (t * 0.5 + i * 0.33) % 1
          return (
            <g key={i}>
              <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? na.cor : '#6a4ec8'} strokeOpacity={lit ? 0.5 : 0.12 + w * 0.18} strokeWidth={lit ? 1.6 : 1 + w * 1.4} strokeLinecap="round" />
              {lit && <circle cx={lerp(na.x, nb.x, tr)} cy={lerp(na.y, nb.y, tr)} r={2.2} fill={na.cor} opacity={0.9} />}
            </g>
          )
        })}
        {GNODES.map((n, i) => {
          const fl = Math.sin(t * 0.5 + i * 1.3) * 2.2
          const isA = active === i
          const dim = !isLit(i)
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y + fl})`} style={{ opacity: dim ? 0.45 : 1, transition: 'opacity .4s' }}>
              {isA && <circle r={n.r + 6} fill="none" stroke={n.cor} strokeWidth={1} strokeOpacity={0.4 + 0.25 * Math.sin(t * 3)} />}
              <circle r={n.r} fill={n.cor} fillOpacity={isA ? 0.95 : 0.82} />
              <text y={n.r + 11} textAnchor="middle" fontSize="10" fill="var(--ink-soft, #3d3852)" fontFamily="var(--font-display), serif" fontWeight={isA ? 600 : 400}>{n.id}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Objetivos (bullets) + Evolução (linhas) ─────────────────────────────
function Bullet({ label, meta, baseline, current, target, sweep, color = 'var(--amber)' }: {
  label: string; meta: string; baseline: number; current: number; target: number; sweep: number; color?: string
}) {
  const val = baseline + (current - baseline) * sweep
  return (
    <div className="bullet">
      <div className="bullet-top"><span className="bullet-label">{label}</span><span className="bullet-meta">{meta}</span></div>
      <div className="bullet-track">
        <span className="bullet-band b1" /><span className="bullet-band b2" style={{ width: '62%' }} /><span className="bullet-band b3" style={{ width: '30%' }} />
        <span className="bullet-measure" style={{ width: val + '%', background: color }} />
        <span className="bullet-target" style={{ left: target + '%' }} />
        <span className="bullet-base" style={{ left: baseline + '%' }} />
      </div>
      <div className="bullet-scale"><span>baseline</span><span className="bullet-now" style={{ color }}>{Math.round(val)}%</span><span>alvo {target}%</span></div>
    </div>
  )
}

function LongChart({ p }: { p: number }) {
  const N = 14
  const series = [
    { id: 'humor', color: 'var(--accent)', pts: [40, 38, 45, 42, 50, 48, 55, 60, 58, 64, 66, 70, 72, 76] },
    { id: 'abertura', color: 'var(--sage)', pts: [30, 34, 33, 40, 44, 42, 50, 54, 58, 56, 62, 66, 70, 73] },
  ]
  const W = 520, H = 180, padL = 8, padR = 8
  const xx = (i: number) => padL + (i / (N - 1)) * (W - padL - padR)
  const yy = (v: number) => H - 18 - (v / 100) * (H - 36)
  const milestones = [4, 7, 11]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="longchart" fill="none">
      {[0, 1, 2, 3].map(g => <line key={g} x1="0" x2={W} y1={18 + g * ((H - 36) / 3)} y2={18 + g * ((H - 36) / 3)} stroke="rgba(26,24,37,.06)" strokeWidth="1" />)}
      {series.map(s => {
        const d = s.pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xx(i)} ${yy(v)}`).join(' ')
        return <path key={s.id} d={d} stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      })}
      {milestones.map(m => {
        const o = clamp01((p - (m / N)) / 0.06)
        return (
          <g key={m} style={{ opacity: o }}>
            <line x1={xx(m)} y1="14" x2={xx(m)} y2={H - 14} stroke="var(--amber)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={xx(m)} cy={yy(series[0].pts[m])} r="4" fill="var(--amber)" />
          </g>
        )
      })}
      <circle cx={xx(N - 1)} cy={yy(series[0].pts[N - 1])} r={p > 0.97 ? 5 : 0} fill="var(--accent)" />
    </svg>
  )
}

export function AnimatedEvolucao() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  const sweep = ease(clamp01(((t % 8) / 8) / 0.75))
  return (
    <div className="evo-grid" ref={ref}>
      <div className="evo-card">
        <div className="evo-card-head">
          <span className="evo-tag" style={{ color: 'var(--amber)', background: 'rgba(176,125,64,.12)' }}>objetivos · SMART + GAS</span>
          <h3>Objetivos Terapêuticos</h3>
        </div>
        <div className="bullets">
          <Bullet label="Autoestima" meta="GAS · escala −2…+2" baseline={20} current={68} target={75} sweep={sweep} />
          <Bullet label="Regulação da ansiedade" meta="freq. semanal" baseline={30} current={55} target={70} sweep={sweep} color="var(--accent)" />
          <Bullet label="Higiene do sono" meta="noites/semana" baseline={15} current={48} target={65} sweep={sweep} color="var(--sage)" />
        </div>
        <p className="evo-note">Métrica, baseline, alvo e prazo — a posição atual em relação ao alvo, sessão após sessão.</p>
      </div>

      <div className="evo-card">
        <div className="evo-card-head">
          <span className="evo-tag" style={{ color: 'var(--accent)', background: 'rgba(106,78,200,.1)' }}>evolução · longitudinal</span>
          <h3>Evolução Registrada</h3>
        </div>
        <LongChart p={sweep} />
        <div className="evo-legend">
          <span><i style={{ background: 'var(--accent)' }} />humor</span>
          <span><i style={{ background: 'var(--sage)' }} />abertura</span>
          <span><i style={{ background: 'var(--amber)' }} />marco extraído</span>
        </div>
        <p className="evo-note">Humor, ritmo, presença e abertura ao longo do processo. Marcos extraídos automaticamente das sessões anteriores.</p>
      </div>
      <EvolStyles />
    </div>
  )
}

function EvolStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .evo-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:36px; }
      @media (max-width:900px) { .evo-grid { grid-template-columns:1fr; } }
      .evo-card { background:var(--card); border:1px solid var(--border); border-radius:22px; padding:28px 30px; box-shadow:0 6px 30px rgba(26,24,37,.04); }
      .evo-card-head { margin-bottom:24px; }
      .evo-tag { display:inline-block; font-size:12px; font-weight:600; letter-spacing:1px; text-transform:uppercase; padding:5px 12px; border-radius:20px; }
      .evo-card-head h3 { font-family:var(--font-display), serif; font-weight:400; font-size:28px; color:var(--ink); margin:12px 0 0; letter-spacing:-.3px; }
      .bullets { display:flex; flex-direction:column; gap:22px; }
      .bullet-top { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px; }
      .bullet-label { font-size:15px; font-weight:500; color:var(--ink); }
      .bullet-meta { font-size:12.5px; color:var(--muted); }
      .bullet-track { position:relative; height:14px; border-radius:8px; background:rgba(26,24,37,.05); overflow:visible; }
      .bullet-band { position:absolute; left:0; top:0; bottom:0; border-radius:8px; }
      .bullet-band.b1 { width:100%; background:rgba(26,24,37,.04); }
      .bullet-band.b2 { background:rgba(26,24,37,.06); }
      .bullet-band.b3 { background:rgba(26,24,37,.09); }
      .bullet-measure { position:absolute; left:0; top:3px; bottom:3px; border-radius:6px; transition:width .1s linear; }
      .bullet-target { position:absolute; top:-4px; bottom:-4px; width:3px; border-radius:2px; background:var(--ink); transform:translateX(-50%); }
      .bullet-base { position:absolute; top:50%; width:8px; height:8px; border-radius:50%; background:#fff; border:2px solid var(--muted); transform:translate(-50%,-50%); }
      .bullet-scale { display:flex; justify-content:space-between; margin-top:7px; font-size:12px; color:var(--muted); }
      .bullet-now { font-weight:600; }
      .longchart { width:100%; height:auto; margin:6px 0 14px; }
      .evo-legend { display:flex; gap:20px; margin-bottom:16px; flex-wrap:wrap; }
      .evo-legend span { display:flex; align-items:center; gap:7px; font-size:13px; color:var(--muted); }
      .evo-legend i { width:14px; height:3px; border-radius:2px; }
      .evo-note { font-size:14px; line-height:1.5; color:var(--muted); font-weight:300; margin:0; }
    ` }} />
  )
}
