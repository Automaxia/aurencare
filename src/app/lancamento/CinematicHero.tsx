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

const NATURE: Record<string, { color: string }> = {
  emocional:   { color: '#c4607a' },
  relacional:  { color: '#6a4ec8' },
  situacional: { color: '#b07d40' },
  cognitivo:   { color: '#5a9e8a' },
}

// Temas: relevância clínica (rel → tamanho do nó) + como apareceram na fala.
type Quote = { s: number; q: string }
const THEMES: Record<string, { nat: string; rel: number; quotes: Quote[] }> = {
  ansiedade:  { nat: 'emocional',   rel: 0.95, quotes: [{ s: 2, q: 'meu peito aperta toda noite antes de dormir' }, { s: 7, q: 'fico no automático esperando algo dar errado' }, { s: 11, q: 'a respiração some quando penso no trabalho' }] },
  trabalho:   { nat: 'situacional', rel: 0.80, quotes: [{ s: 3, q: 'as reuniões de quinta me esgotam' }, { s: 8, q: 'levo o serviço pra dentro de casa' }, { s: 13, q: 'não consigo desligar quando chego' }] },
  cobrança:   { nat: 'situacional', rel: 0.72, quotes: [{ s: 4, q: 'senti que cobraram demais de mim na reunião' }, { s: 7, q: 'tenho medo de cobrar pelo meu próprio trabalho' }, { s: 12, q: 'de novo aquela sensação de estar devendo' }] },
  autoestima: { nat: 'cognitivo',   rel: 0.78, quotes: [{ s: 4, q: 'acho que nunca é bom o suficiente' }, { s: 9, q: 'me surpreendi defendendo o que penso' }, { s: 14, q: 'topei algo difícil sem me diminuir' }] },
  mãe:        { nat: 'relacional',  rel: 0.90, quotes: [{ s: 1, q: 'ligo pra minha mãe e travo' }, { s: 6, q: 'sinto que preciso dar conta por ela' }, { s: 10, q: 'consegui dizer não sem culpa' }] },
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
                const c = n.nat ? NATURE[n.nat].color : 'var(--accent)'
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
                  <div className="cine-mini" style={{ opacity: composed * (1 - focus[i]), transform: `translate(-50%,-50%) scale(${0.82 + 0.18 * composed})` }}>
                    <SatGlyph idx={i} />
                  </div>
                  <div className="cine-detail" style={{ opacity: focus[i], pointerEvents: focus[i] > 0.5 ? 'auto' : 'none', transform: `translate(-50%,-50%) scale(${0.92 + 0.08 * focus[i]})` }}>
                    <SatDetail idx={i} f={focus[i]} t={t} />
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
        <circle key={i} cx={x as number} cy={y as number} r="4.5" fill={NATURE[n as string].color} />)}
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

function SatDetail({ idx, f, t }: { idx: number; f: number; t: number }) {
  if (idx === 0) return <TemasDetail f={f} t={t} />
  if (idx === 1) return <SessaoDetail f={f} />
  if (idx === 2) return <EvolDetail f={f} />
  return <VideoDetail f={f} t={t} />
}

const CD_NODES = [
  { id: 'ansiedade', x: 168, y: 86 }, { id: 'trabalho', x: 372, y: 70 },
  { id: 'cobrança', x: 430, y: 178 }, { id: 'autoestima', x: 256, y: 196 },
  { id: 'mãe', x: 110, y: 196 },
]
const CD_EDGES: [number, number][] = [[0, 1], [1, 2], [0, 4], [3, 4], [0, 3], [2, 3]]

function TemasDetail({ f, t }: { f: number; t: number }) {
  const grow = (i: number) => ease(clamp01((f - 0.05 - i * 0.05) / 0.16))
  const active = Math.floor(t / 3.2) % CD_NODES.length
  const an = CD_NODES[active]
  const ath = THEMES[an.id]
  const quote = ath.quotes[Math.floor(t / 3.2 / CD_NODES.length) % ath.quotes.length] || ath.quotes[0]
  const c = NATURE[ath.nat].color
  const isNb = (i: number) => CD_EDGES.some(([a, b]) => (a === active && b === i) || (b === active && a === i))
  return (
    <div className="cd-panel cd-graph">
      <div className="cd-tag" style={{ color: '#b9a6f5', borderColor: 'rgba(185,166,245,.35)' }}>relevância clínica · Marina</div>
      <svg viewBox="0 0 520 282" className="cd-graph-svg" fill="none">
        {CD_EDGES.map(([a, b], i) => {
          const na = CD_NODES[a], nb = CD_NODES[b]
          const o = Math.min(grow(a), grow(b))
          const lit = active === a || active === b
          const nc = NATURE[THEMES[na.id].nat].color
          const tr = (t * 0.45 + i * 0.35) % 1
          return (
            <g key={i} style={{ opacity: o }}>
              <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={lit ? nc : '#8b7fb4'} strokeWidth={lit ? 1.5 : 1} strokeOpacity={lit ? 0.6 : 0.18} strokeLinecap="round" />
              {lit && <circle cx={lerp(na.x, nb.x, tr)} cy={lerp(na.y, nb.y, tr)} r="2.4" fill={nc} opacity="0.9" />}
            </g>
          )
        })}
        {CD_NODES.map((n, i) => {
          const g = grow(i)
          const th = THEMES[n.id], nc = NATURE[th.nat].color
          const r = (12 + th.rel * 12) * g
          const fl = Math.sin(t * 0.6 + n.x) * 1.4
          const isA = active === i
          const dim = !isA && !isNb(i)
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y + fl})`} style={{ opacity: g * (dim ? 0.4 : 1), transition: 'opacity .4s' }}>
              {isA && <circle r={r + 11} fill="none" stroke={nc} strokeWidth="1" strokeOpacity={0.45 + 0.25 * Math.sin(t * 3)} />}
              <circle r={r + 5} fill={nc} opacity={0.13} />
              <circle r={r} fill={nc} fillOpacity={isA ? 0.95 : 0.7} />
              <text y={r + 16} fontSize="12.5" textAnchor="middle" fill={isA ? '#efeafb' : '#9990b5'} fontFamily="DM Sans" fontWeight={isA ? 600 : 400}>{n.id}</text>
            </g>
          )
        })}
      </svg>
      <div key={active} className="cd-quote cd-fade">
        <span className="cd-quote-head" style={{ color: c }}>{an.id}<i>·</i>Sessão {quote.s}</span>
        <p>&ldquo;{quote.q}&rdquo;</p>
      </div>
    </div>
  )
}

const CD_CHAT = [
  { who: 'P', tx: 'Como você se sentiu na semana?', at: 0.10 },
  { who: 'C', tx: 'Voltou a vontade de sumir.', at: 0.30 },
  { who: 'P', tx: 'Quando isso voltou?', at: 0.52 },
  { who: 'C', tx: 'Depois da reunião de quinta.', at: 0.70 },
]
function SessaoDetail({ f }: { f: number }) {
  const flag = f > 0.34 ? clamp01((f - 0.34) / 0.12) : 0
  return (
    <div className="cd-panel cd-sess">
      <div className="cd-sess-head">
        <span className="cd-rec"><i />ao vivo</span>
        <span className="cd-sess-id">Fernanda K. · Sessão 7</span>
      </div>
      <div className="cd-chat">
        {CD_CHAT.map((m, i) => {
          const o = clamp01((f - m.at) / 0.12)
          return <div key={i} className={'cd-bub ' + (m.who === 'P' ? 'p' : 'c')} style={{ opacity: o, transform: `translateY(${(1 - o) * 7}px)` }}>{m.tx}</div>
        })}
      </div>
      <div className="cd-flag" style={{ opacity: flag, transform: `translateY(${(1 - flag) * 7}px)` }}>
        <b>&ldquo;sumir&rdquo;</b> já apareceu na sessão <b>4</b> — &ldquo;às vezes só queria sumir um pouco&rdquo;. O contexto aparece sozinho.
      </div>
    </div>
  )
}

function EvolDetail({ f }: { f: number }) {
  const pts = [42, 38, 48, 40, 54, 50, 44, 58, 62, 56, 66, 60, 72, 78]
  const symptom = [80, 76, 78, 70, 66, 68, 58, 54, 50, 46, 40, 38, 32, 26]
  const N = pts.length, Wd = 440, Hd = 168
  const xx = (i: number) => 10 + (i / (N - 1)) * (Wd - 20)
  const yy = (v: number) => Hd - 16 - (v / 100) * (Hd - 30)
  const draw = ease(clamp01((f - 0.08) / 0.7))
  const ln = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xx(i)} ${yy(v)}`).join(' ')
  const bar = ease(clamp01((f - 0.2) / 0.6))
  return (
    <div className="cd-panel cd-evol">
      <div className="cd-tag" style={{ color: 'var(--sage)', borderColor: 'rgba(90,158,138,.4)' }}>evolução · objetivos · sintomas</div>
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="cd-evol-svg" fill="none">
        {[0, 1, 2].map(g => <line key={g} x1="0" x2={Wd} y1={16 + g * ((Hd - 30) / 2)} y2={16 + g * ((Hd - 30) / 2)} stroke="rgba(255,255,255,.06)" />)}
        <path d={ln(pts)} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={ln(symptom)} stroke="var(--rose)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" pathLength={1} strokeDashoffset={1 - draw} opacity=".8" />
        {[4, 9].map(m => <circle key={m} cx={xx(m)} cy={yy(pts[m])} r="3.2" fill="var(--amber)" style={{ opacity: clamp01((draw - m / N) / 0.05) }} />)}
      </svg>
      <div className="cd-evol-foot">
        <div className="cd-bullet">
          <span>Autoestima</span>
          <div className="cd-bar"><i style={{ width: 20 + bar * 52 + '%' }} /><b style={{ left: '75%' }} /></div>
        </div>
        <div className="cd-evol-leg">
          <span><i style={{ background: 'var(--accent)' }} />bem-estar ↑</span>
          <span><i style={{ background: 'var(--rose)' }} />sintomas ↓</span>
        </div>
      </div>
    </div>
  )
}

const CD_MODS = ['Agenda', 'Financeiro', 'WhatsApp', 'Prontuário', 'Cobranças', 'Resumos']
function Silhueta({ tone = 'rgba(185,166,245,.5)' }: { tone?: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" fill={tone}>
      <circle cx="50" cy="38" r="17" />
      <path d="M 18 100 C 18 74 32 62 50 62 C 68 62 82 74 82 100 Z" />
    </svg>
  )
}
function VideoDetail({ f, t }: { f: number; t: number }) {
  return (
    <div className="cd-panel cd-video">
      <div className="cd-vid-tile">
        <div className="cd-vid-ph"><Silhueta /></div>
        <div className="cd-vid-self"><Silhueta tone="rgba(127,205,184,.6)" /></div>
        <div className="cd-vid-wave">
          {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ height: 30 + 55 * Math.abs(Math.sin(t * 3.4 + i)) + '%' }} />)}
        </div>
        <span className="cd-vid-timer">42:18</span>
        <span className="cd-vid-live">videochamada nativa</span>
        <span className="cd-vid-tag">vídeo do paciente</span>
      </div>
      <div className="cd-mods">
        {CD_MODS.map((m, i) => {
          const o = clamp01((f - 0.2 - i * 0.06) / 0.2)
          return <span key={m} className="cd-mod" style={{ opacity: o, transform: `translateY(${(1 - o) * 6}px)` }}>{m}</span>
        })}
      </div>
      <div className="cd-vid-cap">tudo no mesmo lugar onde a continuidade clínica vive</div>
    </div>
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
      .cine-mini, .cine-detail { position:absolute; left:0; top:0; transform-origin:center; will-change:transform,opacity; }
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
      @keyframes cineBlink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
      @keyframes cineGpFade { from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }

      /* painéis de detalhe (aparecem ao focar cada satélite) */
      .cd-panel { border-radius:18px; padding:18px; position:relative; box-shadow:0 30px 80px rgba(26,24,37,.28); }
      .cd-tag { position:absolute; top:12px; left:14px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; border:1px solid; border-radius:14px; padding:4px 10px; z-index:2; }
      .cd-graph { width:430px; background:#16111f; border:1px solid rgba(185,166,245,.2); }
      .cd-graph-svg { width:100%; height:248px; display:block; margin-top:14px; overflow:visible; }
      .cd-quote { margin-top:4px; padding:10px 14px; border-top:1px solid rgba(185,166,245,.16); }
      .cd-fade { animation:cineGpFade .45s ease; }
      .cd-quote-head { font-size:12px; font-weight:600; letter-spacing:.5px; display:inline-flex; align-items:center; gap:7px; }
      .cd-quote-head i { color:rgba(233,228,251,.4); font-style:normal; }
      .cd-quote p { font-family:var(--font-display), serif; font-style:italic; font-size:18px; line-height:1.35; color:#efeafb; margin-top:6px; }
      .cd-sess { width:362px; background:#fff; border:1px solid var(--border); }
      .cd-sess-head { display:flex; align-items:center; gap:10px; padding-bottom:12px; border-bottom:1px solid var(--border); margin-bottom:14px; }
      .cd-rec { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color:var(--rose); }
      .cd-rec i { width:7px; height:7px; border-radius:50%; background:var(--rose); animation:cineBlink 1.4s infinite; }
      .cd-sess-id { font-size:12px; color:var(--muted); }
      .cd-chat { display:flex; flex-direction:column; gap:10px; min-height:140px; }
      .cd-bub { max-width:84%; font-size:14px; line-height:1.4; padding:9px 13px; border-radius:13px; }
      .cd-bub.p { background:rgba(106,78,200,.1); color:#391d96; align-self:flex-start; border-bottom-left-radius:3px; }
      .cd-bub.c { background:rgba(90,158,138,.13); color:var(--ink); align-self:flex-end; border-bottom-right-radius:3px; }
      .cd-flag { margin-top:12px; font-size:13px; line-height:1.45; color:var(--ink-soft); background:rgba(106,78,200,.07); border:1px solid rgba(106,78,200,.18); border-radius:11px; padding:10px 13px; }
      .cd-flag b { color:#391d96; }
      .cd-evol { width:412px; background:#16111f; border:1px solid rgba(185,166,245,.2); }
      .cd-evol-svg { width:100%; height:170px; display:block; margin-top:16px; overflow:visible; }
      .cd-evol-foot { margin-top:6px; }
      .cd-bullet { display:flex; align-items:center; gap:10px; font-size:12px; color:rgba(233,228,251,.8); margin-bottom:10px; }
      .cd-bullet > span { width:74px; }
      .cd-bar { position:relative; flex:1; height:9px; border-radius:6px; background:rgba(255,255,255,.08); }
      .cd-bar i { position:absolute; left:0; top:0; bottom:0; border-radius:6px; background:var(--amber); }
      .cd-bar b { position:absolute; top:-3px; bottom:-3px; width:2px; background:#fff; }
      .cd-evol-leg { display:flex; gap:16px; }
      .cd-evol-leg span { display:flex; align-items:center; gap:6px; font-size:11px; color:rgba(233,228,251,.7); }
      .cd-evol-leg i { width:14px; height:3px; border-radius:2px; }
      .cd-video { width:360px; background:#16111f; border:1px solid rgba(185,166,245,.2); }
      .cd-vid-tile { position:relative; height:170px; border-radius:12px; overflow:hidden; background:linear-gradient(135deg,#2c2245,#1a1428); display:flex; align-items:center; justify-content:center; }
      .cd-vid-ph { position:absolute; inset:0; display:flex; align-items:flex-end; justify-content:center; overflow:hidden; background:repeating-linear-gradient(45deg, rgba(185,166,245,.05) 0 8px, transparent 8px 16px), linear-gradient(135deg,#2c2245,#1a1428); }
      .cd-vid-ph svg { width:120px; height:120px; }
      .cd-vid-self { position:absolute; right:12px; bottom:12px; width:48px; height:34px; border-radius:6px; overflow:hidden; background:linear-gradient(135deg,#1d3a32,#16111f); border:1.5px solid rgba(255,255,255,.22); display:flex; align-items:flex-end; justify-content:center; }
      .cd-vid-self svg { width:32px; height:32px; }
      .cd-vid-wave { position:absolute; left:14px; bottom:14px; display:flex; align-items:flex-end; gap:3px; height:24px; }
      .cd-vid-wave span { width:3px; background:#7fcdb8; border-radius:2px; }
      .cd-vid-timer { position:absolute; left:14px; top:12px; font-size:12px; color:rgba(255,255,255,.85); font-weight:500; }
      .cd-vid-live { position:absolute; right:12px; top:12px; font-size:10px; color:#b9a6f5; background:rgba(185,166,245,.14); padding:3px 8px; border-radius:12px; }
      .cd-vid-tag { position:absolute; right:12px; bottom:14px; font-size:10px; font-family:ui-monospace,monospace; letter-spacing:.5px; color:rgba(233,228,251,.55); background:rgba(21,16,31,.5); padding:3px 8px; border-radius:6px; }
      .cd-mods { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; }
      .cd-mod { font-size:12px; font-weight:500; color:#b9a6f5; background:rgba(185,166,245,.1); border:1px solid rgba(185,166,245,.22); padding:6px 12px; border-radius:18px; }
      .cd-vid-cap { font-size:12px; color:rgba(233,228,251,.6); margin-top:12px; font-style:italic; }
      @media (max-width:760px) { .cine { height:680vh; } }
    ` }} />
  )
}
