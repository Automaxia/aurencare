'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hero cinemático (scroll-driven) — reconstrução da proposta v3.
 * Fase 1 (autoplay no mount): a espiral se desenha, os nós surgem sessão a
 * sessão e os 4 satélites compõem a marca. Fase 2 (scroll em degraus): a câmera
 * dá zoom em cada satélite (Temas · Sessão · Evolução · Plataforma), legenda o
 * destino, e termina num outro com CTA. Tudo dentro de uma só seção alta sticky.
 */

const W = 1280, H = 800, CX = 640, CY = 392
const Z = 1.34

const NATURE: Record<string, string> = {
  emocional: '#6a4ec8', relacional: '#c4607a', situacional: '#5a9e8a', cognitivo: '#b07d40',
}

const SAT = {
  temas:    { x: 904, y: 250, label: 'Temas' },
  sessao:   { x: 376, y: 250, label: 'Sessão' },
  evolucao: { x: 904, y: 534, label: 'Evolução' },
  video:    { x: 376, y: 534, label: 'Plataforma' },
} as const
const SAT_LIST = [SAT.temas, SAT.sessao, SAT.evolucao, SAT.video]

const STOPS = [
  { x: CX, y: CY, z: 1.0 },
  { x: SAT.temas.x,    y: SAT.temas.y,    z: Z },
  { x: CX, y: CY, z: 1.0 },
  { x: SAT.sessao.x,   y: SAT.sessao.y,   z: Z },
  { x: CX, y: CY, z: 1.0 },
  { x: SAT.evolucao.x, y: SAT.evolucao.y, z: Z },
  { x: CX, y: CY, z: 1.0 },
  { x: SAT.video.x,    y: SAT.video.y,    z: Z },
  { x: CX, y: CY, z: 1.0 },
]
const NSTOPS = STOPS.length
const FOCUS_STEP = [1, 3, 5, 7]

const STOP_CAP: Record<number, { eye: string; tx: string }> = {
  1: { eye: 'Grafo semântico',     tx: 'Os temas se conectam — e ganham relevância clínica.' },
  3: { eye: 'Durante a sessão',    tx: 'O contexto chega com você, sem precisar lembrar.' },
  5: { eye: 'Evolução registrada', tx: 'Objetivos, oscilações e a redução de sintomas.' },
  7: { eye: 'Tudo integrado',      tx: 'A prática inteira, numa só plataforma.' },
}

const SPIRAL_NODES = Array.from({ length: 8 }).map((_, i) => {
  const ang = (-92 + i * 52) * Math.PI / 180
  const rad = 54 + i * 12.5
  const nat = [null, 'emocional', null, 'situacional', null, 'relacional', null, 'cognitivo'][i]
  return { x: CX + rad * Math.cos(ang), y: CY + rad * Math.sin(ang), nat, at: 0.12 + i * 0.085 }
})

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const ease = (x: number) => x * x * (3 - 2 * x)
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)

function camAtStep(s: number) {
  const i = Math.max(0, Math.min(NSTOPS - 2, Math.floor(s)))
  const f = ease(clamp01(s - i))
  const a = STOPS[i], b = STOPS[i + 1]
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f) }
}

export function CinematicHero() {
  const wrapRef = useRef<HTMLElement>(null)
  const cam = useRef(0)
  const target = useRef(0)
  const buildStart = useRef<number | null>(null)
  const [st, setSt] = useState({ step: 0, t: 0, fit: 1, build: 0 })

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    buildStart.current = reduce ? performance.now() - 6000 : performance.now()
    let raf = 0

    const readTarget = () => {
      const el = wrapRef.current
      if (!el) return
      const total = el.offsetHeight - window.innerHeight
      const rawP = clamp01(-el.getBoundingClientRect().top / Math.max(1, total))
      const x = rawP * (NSTOPS - 1)
      const i = Math.floor(x), f = clamp01(x - i)
      target.current = i + smoother(f)
    }
    const tick = () => {
      readTarget()
      cam.current += (target.current - cam.current) * 0.16
      if (Math.abs(target.current - cam.current) < 0.0008) cam.current = target.current
      const now = performance.now()
      let build = buildStart.current != null ? clamp01((now - buildStart.current) / 5400) : 0
      build = Math.max(build, clamp01(cam.current * 2.6))
      const fit = Math.min(window.innerWidth / W, window.innerHeight / H)
      setSt({ step: cam.current, t: now / 1000, fit, build })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onScroll = () => readTarget()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll) }
  }, [])

  const { step, t, fit, build } = st
  const cm = camAtStep(step)
  const camTransform = `translate(${CX - cm.x * cm.z}px, ${CY - cm.y * cm.z}px) scale(${cm.z})`
  const buildP = ease(build)

  const focus = FOCUS_STEP.map(fs => ease(clamp01(1 - Math.abs(step - fs))))
  const maxFocus = Math.max(0, ...focus)
  const composed = clamp01((buildP - 0.5) / 0.5)
  const outro = ease(clamp01((step - 7.45) / 0.5))
  const headline = ease(clamp01(build * 1.4 - 0.2)) * clamp01(1 - step * 4) * (1 - outro)
  const cap = STOP_CAP[Math.round(step)]
  const hint = clamp01((build - 0.9) / 0.1) * clamp01(1 - step * 3) * (1 - outro)
  const spin = (1 - buildP) * -140
  const idle = composed * (1 - maxFocus)

  return (
    <section className="cine" ref={wrapRef}>
      <div className="cine-sticky">
        <div className="cine-headline" style={{ opacity: headline, transform: `translate(-50%, ${(1 - headline) * -10}px)` }}>
          <div className="cine-headline-tx serif">A terapia acontece ao longo do tempo. A memória humana <em>nem sempre acompanha.</em></div>
          <div className="cine-headline-foot">A Audere acompanha junto — para que nada importante se perca.</div>
        </div>

        <div className="cine-fit" style={{ transform: `translate(-50%,-50%) scale(${fit})` }}>
          <div className="cine-cam" style={{ transform: camTransform }}>
            <svg className="cine-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
              {SPIRAL_NODES.map((n, i) => {
                const g = ease(clamp01((buildP - n.at) / 0.12))
                if (g <= 0.01) return null
                const c = n.nat ? NATURE[n.nat] : 'var(--accent)'
                const r = (n.nat ? 7 : 3.4) * g
                const fl = Math.sin(t * 0.6 + i) * 1.5 * idle
                return (
                  <g key={i} transform={`translate(${n.x} ${n.y + fl})`}>
                    {n.nat && <circle r={r + 5} fill={c} opacity={0.1 * g} />}
                    <circle r={r} fill={c} opacity={n.nat ? 0.85 : 0.65} />
                  </g>
                )
              })}
            </svg>

            <div className="cine-spiral" style={{ transform: `translate(-50%,-50%) rotate(${spin}deg)` }}>
              <DrawSpiral size={188} p={buildP} />
            </div>
            <div className="cine-brandword" style={{ opacity: composed * (1 - maxFocus * 0.92) }}>
              <div className="cine-brandword-name">audere</div>
              <div className="cine-brandword-sub">Inteligência Clínica Longitudinal</div>
            </div>

            {SAT_LIST.map((pos, i) => {
              const fx = Math.sin(t * 0.5 + i * 1.7) * 7 * idle
              const fy = Math.cos(t * 0.42 + i * 2.3) * 7 * idle
              return (
                <div key={pos.label} className="cine-sat" style={{ left: pos.x, top: pos.y, transform: `translate(${fx}px, ${fy}px)` }}>
                  <div className="cine-mini" style={{ opacity: composed * (1 - focus[i] * 0.4), transform: `translate(-50%,-50%) scale(${0.82 + 0.5 * composed + focus[i] * 0.9})` }}>
                    <SatGlyph idx={i} />
                  </div>
                  <div className="cine-sat-label" style={{ opacity: composed * (1 - focus[i]) }}>{pos.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {cap && maxFocus > 0.04 && (
          <div className="cine-cap" style={{ opacity: maxFocus }}>
            <div className="cine-cap-eye">{cap.eye}</div>
            <div className="cine-cap-tx serif">{cap.tx}</div>
          </div>
        )}

        {outro > 0.01 && (
          <div className="cine-outro" style={{ opacity: outro, pointerEvents: outro > 0.5 ? 'auto' : 'none' }}>
            <div className="cine-brandword-name" style={{ fontSize: 40 }}>audere</div>
            <h1 className="serif cine-outro-h">Toda a história do paciente, num <em>fio contínuo.</em></h1>
            <div className="cine-outro-cta">
              <a href="#acesso" className="btn btn-primary" onClick={e => { e.preventDefault(); document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth' }) }}>Solicitar acesso →</a>
              <span className="cine-outro-note">continue rolando para os detalhes ↓</span>
            </div>
          </div>
        )}

        <div className="cine-rail"><span style={{ transform: `scaleX(${step / (NSTOPS - 1)})` }} /></div>
        {hint > 0.02 && (
          <div className="cine-hint" style={{ opacity: hint }}>
            <span>role para explorar</span><span className="cine-hint-arrow">↓</span>
          </div>
        )}
      </div>
      <CineStyles />
    </section>
  )
}

// Espiral de Continuidade que se desenha com o progresso p (stroke-dashoffset).
function DrawSpiral({ size, p }: { size: number; p: number }) {
  const paths = [
    'M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16',
    'M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42',
    'M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 46 6 46 14 46 26',
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none">
      {paths.map((d, i) => {
        const seg = clamp01((p - i * 0.22) / 0.5)
        return (
          <path key={i} d={d} stroke="var(--accent)" strokeWidth={1.3} strokeLinecap="round" fill="none"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - seg} opacity={0.9} />
        )
      })}
      <circle cx="46" cy="26" r="2.2" fill="var(--sage)" opacity={clamp01((p - 0.82) / 0.18)} />
    </svg>
  )
}

function SatGlyph({ idx }: { idx: number }) {
  if (idx === 0) return (
    <svg width="62" height="50" viewBox="-26 -20 52 40" fill="none">
      <line x1="-14" y1="-9" x2="14" y2="-5" stroke="#c9bdf0" strokeWidth="1" />
      <line x1="14" y1="-5" x2="0" y2="14" stroke="#c9bdf0" strokeWidth="1" />
      <line x1="-14" y1="-9" x2="0" y2="14" stroke="#c9bdf0" strokeWidth="1" />
      {[['emocional', -14, -9], ['situacional', 14, -5], ['relacional', 0, 14]].map(([n, x, y], i) =>
        <circle key={i} cx={x as number} cy={y as number} r="4.5" fill={NATURE[n as string]} />)}
    </svg>
  )
  if (idx === 1) return (
    <svg width="58" height="46" viewBox="0 0 58 46" fill="none">
      <rect x="2" y="6" width="34" height="11" rx="5.5" fill="rgba(106,78,200,.55)" />
      <rect x="22" y="26" width="34" height="11" rx="5.5" fill="rgba(90,158,138,.55)" />
    </svg>
  )
  if (idx === 2) return (
    <svg width="64" height="42" viewBox="0 0 64 42" fill="none">
      <path d="M 4 32 L 16 22 L 26 26 L 38 12 L 50 17 L 60 7" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg width="54" height="42" viewBox="0 0 54 42" fill="none">
      <rect x="3" y="5" width="48" height="32" rx="6" fill="none" stroke="rgba(106,78,200,.5)" strokeWidth="1.4" />
      <path d="M 22 15 L 33 21 L 22 27 Z" fill="rgba(106,78,200,.6)" />
    </svg>
  )
}

function CineStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .cine { position:relative; height:760vh; background:var(--page); }
      .cine-sticky { position:sticky; top:0; height:100vh; overflow:hidden;
        background:radial-gradient(circle at 50% 42%, #fdfcf9, var(--page) 60%); }
      .cine .serif { font-family:var(--font-display), serif; font-weight:300; line-height:1.1; letter-spacing:-.6px; }
      .cine .serif em { font-style:italic; color:var(--accent); }
      .cine-fit { position:absolute; left:50%; top:50%; width:${W}px; height:${H}px; transform-origin:center center; }
      .cine-cam { position:absolute; inset:0; transform-origin:0 0; will-change:transform; }
      .cine-svg { position:absolute; inset:0; overflow:visible; }
      .cine-spiral { position:absolute; left:${CX}px; top:${CY}px; transform-origin:center; }
      .cine-sat { position:absolute; }
      .cine-mini { position:absolute; left:0; top:0; transform-origin:center; will-change:transform,opacity; }
      .cine-sat-label { position:absolute; left:0; top:46px; transform:translateX(-50%);
        font-size:13px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
      .cine-headline { position:absolute; left:50%; top:7%; transform:translateX(-50%); width:min(640px,86vw);
        text-align:center; z-index:5; pointer-events:none; }
      .cine-headline-tx { font-size:clamp(22px,2.7vw,36px); color:var(--ink); line-height:1.18; }
      .cine-headline-foot { font-size:clamp(14px,1.3vw,16px); color:var(--muted); margin-top:14px; font-weight:300; }
      .cine-brandword { position:absolute; left:${CX}px; top:498px; transform:translateX(-50%); text-align:center; pointer-events:none; }
      .cine-brandword-name { font-family:var(--font-display), serif; font-size:40px; font-weight:400; letter-spacing:.5px; color:#391d96; line-height:1; }
      .cine-brandword-sub { font-family:var(--font-display), serif; font-style:italic; font-weight:300; font-size:15px; color:rgba(106,78,200,.6); margin-top:3px; }
      .cine-cap { position:absolute; bottom:84px; left:0; right:0; text-align:center; z-index:5; pointer-events:none; padding-inline:24px; transition:opacity .3s; }
      .cine-cap-eye { font-size:13px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:var(--accent); margin-bottom:10px; }
      .cine-cap-tx { font-size:clamp(24px,3vw,40px); color:var(--ink); max-width:760px; margin:0 auto; line-height:1.15; }
      .cine-outro { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; z-index:6; padding:24px; }
      .cine-outro::before { content:""; position:absolute; inset:0; z-index:-1;
        background:radial-gradient(circle at 50% 48%, rgba(250,249,246,.94) 30%, rgba(250,249,246,.72) 60%, rgba(250,249,246,.4)); }
      .cine-outro-h { font-size:clamp(34px,5vw,60px); color:var(--ink); margin:18px 0 30px; max-width:820px; }
      .cine-outro-cta { display:flex; flex-direction:column; align-items:center; gap:16px; }
      .cine-outro-note { font-size:14px; color:var(--muted); }
      .cine .btn { font-family:inherit; font-size:16px; font-weight:500; border:none; border-radius:40px; padding:15px 28px; cursor:pointer; text-decoration:none; transition:transform .16s, box-shadow .16s; }
      .cine .btn-primary { background:var(--accent); color:#fff; box-shadow:0 12px 30px rgba(106,78,200,.28); }
      .cine .btn-primary:hover { transform:translateY(-2px); box-shadow:0 18px 40px rgba(106,78,200,.36); }
      .cine-rail { position:absolute; left:0; right:0; bottom:0; height:3px; background:rgba(26,24,37,.06); z-index:7; }
      .cine-rail span { display:block; height:100%; transform-origin:left; background:linear-gradient(90deg,var(--accent),var(--sage)); }
      .cine-hint { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px;
        font-size:13px; letter-spacing:1px; color:var(--muted); z-index:7; }
      .cine-hint-arrow { font-size:18px; animation:cineBob 1.6s ease-in-out infinite; }
      @keyframes cineBob { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(6px); } }
      @media (max-width:760px) { .cine { height:680vh; } }
    ` }} />
  )
}
