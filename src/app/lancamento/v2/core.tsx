'use client'
/* Landing v2 — núcleo: tokens, marca (Spiral/Wordmark), hooks de animação,
   primitivas de seção. Portado do handoff de alta fidelidade para React/Next. */
import React, { useState, useRef, useEffect } from 'react'

export const LINK = 'app.audere.ia.br/lancamento'

export const NATURE = {
  emocional:   { color: '#c4607a', soft: 'rgba(196,96,122,.16)', label: 'Emocional' },
  relacional:  { color: '#6a4ec8', soft: 'rgba(106,78,200,.16)', label: 'Relacional' },
  situacional: { color: '#b07d40', soft: 'rgba(176,125,64,.16)', label: 'Situacional' },
  cognitivo:   { color: '#5a9e8a', soft: 'rgba(90,158,138,.16)', label: 'Cognitivo' },
} as const

/* ── easing ── */
export const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
export const easeOut = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export function seg(t: number, inStart: number, inDur: number, outStart?: number, outDur?: number) {
  const a = ease((t - inStart) / inDur)
  const b = outStart == null ? 1 : 1 - ease((t - outStart) / (outDur || 0.6))
  return Math.max(0, Math.min(a, b))
}

/* ── hooks ── */
/** tempo contínuo em segundos enquanto ativo; respeita prefers-reduced-motion (P5). */
export function useRaf(active = true) {
  const [t, setT] = useState(0)
  const raf = useRef(0)
  const base = useRef<number | null>(null)
  const acc = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (!active) { base.current = null; return }
    const tick = (now: number) => {
      if (base.current == null) base.current = now
      setT(acc.current + (now - base.current) / 1000)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf.current)
      if (base.current != null) acc.current += (performance.now() - base.current) / 1000
      base.current = null
    }
  }, [active])
  return t
}

/** observa visibilidade; retorna [ref, visível, jáApareceu]. */
export function useInView(opts: { rootMargin?: string } = {}) {
  const ref = useRef<any>(null)
  const [vis, setVis] = useState(false)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      setVis(e.isIntersecting)
      if (e.isIntersecting) setSeen(true)
    }, { threshold: 0, rootMargin: opts.rootMargin ?? '0px 0px -12% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, vis, seen] as const
}

/* ── Espiral da marca ── */
export function Spiral({ size = 120, color = 'var(--accent)', tip = 'var(--sage)', sw = 1.4, opacity = 1, style = {} }:
  { size?: number; color?: string; tip?: string; sw?: number; opacity?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" style={{ opacity, display: 'block', ...style }}>
      <path d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="46" cy="26" r="2" fill={tip} />
    </svg>
  )
}

/* espiral que se desenha conforme p 0..1 */
export function DrawSpiral({ size = 200, p = 1, color = 'var(--accent)', tip = 'var(--sage)', sw = 1.4, showTip = true }:
  { size?: number; p?: number; color?: string; tip?: string; sw?: number; showTip?: boolean }) {
  const paths = [
    { d: 'M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16', s: 0.00, e: 0.34 },
    { d: 'M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42', s: 0.28, e: 0.64 },
    { d: 'M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26', s: 0.55, e: 1.0 },
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" style={{ display: 'block' }}>
      {paths.map((pa, i) => {
        const local = ease(clamp01((p - pa.s) / (pa.e - pa.s)))
        return <path key={i} d={pa.d} stroke={color} strokeWidth={sw} strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={1 - local} />
      })}
      {showTip && <circle cx="46" cy="26" r="2" fill={tip} style={{ opacity: clamp01((p - 0.97) / 0.03) }} />}
    </svg>
  )
}

/* ── Wordmark ── */
export function Wordmark({ size = 28, color = 'var(--accent-deep)', dark = false, sub = 'Inteligência Clínica Longitudinal' }:
  { size?: number; color?: string; dark?: boolean; sub?: string | null }) {
  const subColor = dark ? 'rgba(233,230,245,.5)' : 'rgba(106,78,200,.55)'
  return (
    <div className="wm">
      <Spiral size={size * 1.28} sw={1.7} color={dark ? '#b9a6f5' : 'var(--accent)'} tip="var(--sage)" />
      <div>
        <div className="wm-name" style={{ fontSize: size, color: dark ? '#f4f1fb' : color }}>audere</div>
        {sub && <div className="wm-sub" style={{ fontSize: size * 0.4, color: subColor, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ── primitivas de seção ── */
export function Eyebrow({ children, color = 'var(--accent)', style = {} }:
  { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return <div className="eyebrow-sm" style={{ color, ...style }}>{children}</div>
}

export function Display({ children, size = 56, color = 'var(--ink)', style = {}, as = 'h2' }:
  { children: React.ReactNode; size?: number | string; color?: string; style?: React.CSSProperties; as?: any }) {
  const Tag = as
  return <Tag className="serif" style={{ fontSize: size, color, ...style }}>{children}</Tag>
}

export function Section({ id, children, dark = false, tint = false, pad = 'clamp(96px,11vw,160px)', style = {} }:
  { id?: string; children: React.ReactNode; dark?: boolean; tint?: boolean; pad?: string; style?: React.CSSProperties }) {
  const [ref, , seen] = useInView()
  return (
    <section id={id} ref={ref}
      className={'sec' + (seen ? ' in' : '') + (dark ? ' sec-dark' : '')}
      style={{ paddingTop: pad, paddingBottom: pad, background: dark ? 'var(--night)' : (tint ? 'var(--surface)' : 'var(--page)'), ...style }}>
      <div className="wrap">{children}</div>
    </section>
  )
}

export function Pill({ children, color = 'var(--accent)', soft = 'rgba(106,78,200,.09)', style = {} }:
  { children: React.ReactNode; color?: string; soft?: string; style?: React.CSSProperties }) {
  return <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: .2, color, background: soft, padding: '8px 16px', borderRadius: 22, whiteSpace: 'nowrap', ...style }}>{children}</span>
}
