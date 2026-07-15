'use client'
/* Hero — camada de overlay HTML sobre as cenas 3D (âncoras projetadas em 3D +
   cards "realistas" + ticker do grafo + dashboard de objetivos). Porte fiel do
   design original (02-hero3d-component.js), adaptado para Next: os dados vêm do
   objeto SCENES (prop `scenes`), não de window.AudereH3DScenes.

   O engine posiciona cada [data-anchor] a cada frame (attachAnchors/updateAnchors),
   projetando `data-pos` (coord 3D) para a tela e controlando a opacidade conforme
   a cena ativa. Os cards que NÃO vivem no espaço 3D (ticker, objdash) são overlays
   fixos, ativados por `active`. */
import React from 'react'

/* helpers (de 01-core.js) */
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
function seg(t: number, inStart: number, inDur: number, outStart?: number, outDur?: number) {
  const a = ease((t - inStart) / inDur)
  const b = outStart == null ? 1 : 1 - ease((t - outStart) / (outDur || 0.6))
  return Math.max(0, Math.min(a, b))
}

/* âncora projetada em 3D — o engine posiciona via style a cada frame */
function A3({ state, pos, delay = 0, align, hold, out, avoidLeft, className = '', children }: {
  state: string; pos: number[]; delay?: number; align?: string; hold?: number
  out?: number; avoidLeft?: boolean; className?: string; children: React.ReactNode
}) {
  return (
    <div className={'h3d-anch ' + className} data-anchor="1" data-state={state}
      data-pos={pos.join(',')} data-delay={delay} data-align={align || ''}
      data-hold={hold != null ? hold : undefined} data-out={out != null ? out : undefined}
      data-avoid={avoidLeft ? 'left' : undefined}>
      {children}
    </div>
  )
}

/* ── 02 · sessões — card de sessão ao vivo (espelha a UI real do produto) ── */
const SESS_TRANSCRIPT = [
  { who: 'P', tx: 'Como você se sentiu na semana?', at: 0.3 },
  { who: 'C', tx: 'Foi difícil. Voltou a vontade de sumir.', at: 1.6 },
  { who: 'P', tx: 'Quando isso voltou?', at: 3.7 },
  { who: 'C', tx: 'Depois da reunião de quinta.', at: 5.0 },
]
const SESS_THEMES = [
  { id: 'sumir', at: 1.6, cls: 'nat-e' },
  { id: 'trabalho', at: 5.0, cls: 'nat-s' },
  { id: 'cansaço', at: 7.6, cls: 'nat-e' },
  { id: 'mãe', at: 99, cls: 'nat-r off' },
]
const SESS_LOOP = 11

function SessHeroGroup() {
  const [t, setT] = React.useState(0)
  React.useEffect(() => {
    let raf = 0, start = performance.now()
    const loop = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const L = SESS_LOOP
  const lt = t % L
  const rhythm = Math.round(50 + 14 * Math.sin(t * 0.7))
  const sumirOn = lt > 1.6 && lt < L - 0.7

  return (
    <React.Fragment>
      <A3 state="sessoes" pos={[-0.55, -0.2, 0.35]} delay={0.3} hold={Infinity} className="h3d-sess">
        <div className="h3d-sess-top">
          <span className="h3d-sess-live"><span className="h3d-rec" />Sessão ao vivo</span>
          <span className="h3d-sess-who">Fernanda K. · Sessão 7 · 18:42</span>
          <span className="h3d-sess-pill">Presente</span>
        </div>
        <div className="h3d-sess-chat">
          {SESS_TRANSCRIPT.map((m, i) => {
            const o = seg(lt, m.at, 0.5, L - 0.7, 0.7)
            return (
              <div key={i} className={m.who === 'P' ? 'h3d-sess-p' : 'h3d-sess-c'}
                style={{ opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
                {m.tx}
              </div>
            )
          })}
        </div>
        <div className="h3d-sess-note" style={{ opacity: sumirOn ? 1 : 0, transform: `translateY(${sumirOn ? 0 : 6}px)` }}>
          <span className="h3d-sess-note-dot" />
          “sumir” já apareceu nas sessões <b>4</b> e <b>7</b> — você não precisa lembrar.
        </div>
      </A3>
      <A3 state="sessoes" pos={[1.35, 0.78, -0.1]} delay={0.5} hold={Infinity} className="h3d-sess-stat">
        <div className="h3d-sess-stat-k">ritmo de fala</div>
        <div className="h3d-sess-bar"><span style={{ width: rhythm + '%' }} /></div>
        <div className="h3d-sess-stat-v">paciente <b>{rhythm}%</b> · descoberta guiada</div>
      </A3>
      <A3 state="sessoes" pos={[1.35, -0.08, -0.1]} delay={0.6} hold={Infinity} className="h3d-sess-stat">
        <div className="h3d-sess-stat-k">temas ao vivo</div>
        <div className="h3d-sess-chips">
          {SESS_THEMES.map((th) => {
            const on = lt > th.at && lt < L - 0.7
            return <span key={th.id} className={'h3d-sess-chip ' + th.cls + (on ? '' : ' off')}>{th.id}</span>
          })}
        </div>
      </A3>
      <A3 state="sessoes" pos={[1.35, -0.92, -0.1]} delay={0.7} hold={Infinity} className="h3d-sess-stat">
        <div className="h3d-sess-stat-k">sinal de atenção</div>
        <div className="h3d-sess-alert"><span className="h3d-sess-alert-dot" />ideação · médio</div>
      </A3>
    </React.Fragment>
  )
}

/* ── 01 · preparar — card de contexto recuperado, itens em sequência ── */
const PREP_ITEMS: { at: number; dot: string; label: React.ReactNode; val: string; note: string }[] = [
  { at: 0.9, dot: '#b07d40', label: <>Objetivo <b>Autoestima</b></>, val: '+18%', note: 'acima do baseline' },
  { at: 2.1, dot: '#6a4ec8', label: <>Tema <b>“mãe”</b> voltou</>, val: '3ª sessão', note: 'reapareceu após 5 semanas' },
  { at: 3.3, dot: '#5a9e8a', label: <>Humor em alta</>, val: '4 sessões', note: 'tendência sustentada' },
  { at: 4.5, dot: '#948da9', label: <>Última sessão</>, val: 'há 12 dias', note: 'retomar o combinado' },
]
const PREP_LOOP = 11

function PrepHeroGroup() {
  const [t, setT] = React.useState(0)
  React.useEffect(() => {
    let raf = 0, start = performance.now()
    const loop = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const lt = t % PREP_LOOP
  const headOn = seg(lt, 0.3, 0.6, PREP_LOOP - 0.7, 0.7)
  return (
    <A3 state="preparar" pos={[0, 0.02, 0.35]} delay={0.2} hold={Infinity} className="h3d-prep">
      <div className="h3d-prep-top" style={{ opacity: headOn, transform: `translateY(${(1 - headOn) * 6}px)` }}>
        <span className="h3d-prep-who">Marina K. · antes da sessão 8</span>
        <span className="h3d-prep-pill">contexto recuperado</span>
      </div>
      <div className="h3d-prep-list">
        {PREP_ITEMS.map((it, i) => {
          const o = seg(lt, it.at, 0.6, PREP_LOOP - 0.7, 0.7)
          return (
            <div key={i} className="h3d-prep-row" style={{ opacity: o, transform: `translateY(${(1 - o) * 9}px)` }}>
              <span className="h3d-prep-dot" style={{ background: it.dot }} />
              <span className="h3d-prep-label">{it.label}</span>
              <span className="h3d-prep-val" style={{ color: it.dot }}>{it.val}</span>
              <span className="h3d-prep-note">{it.note}</span>
            </div>
          )
        })}
      </div>
    </A3>
  )
}

const NAT_COLOR: Record<string, string> = { relacional: '#6a4ec8', emocional: '#c4607a', situacional: '#b07d40', cognitivo: '#5a9e8a' }

export function H3DAnchors({ scenes }: { scenes: any }) {
  const nodes = (scenes && scenes.states.temas.nodes) || []
  const focusNode = scenes ? scenes.focusNode : -1
  return (
    <div className="h3d-anchors">
      {/* 01 · preparar — card de contexto recuperado */}
      <PrepHeroGroup />

      {/* 02 · sessões — card de sessão ao vivo, animado */}
      <SessHeroGroup />

      {/* 03 · temas — todos os nós rotulados, cor por natureza (as TAGS do grafo) */}
      {nodes.map((n: any, i: number) => (
        <A3 key={n.id} state="temas" pos={[n.p[0], n.p[1] + 0.13 + (n.freq / 12) * 0.09, n.p[2]]}
          delay={0.15 + i * 0.05} avoidLeft className={'h3d-node' + (i === focusNode ? ' h3d-node-focus' : '')}>
          <span className="h3d-node-dot" style={{ background: NAT_COLOR[n.nat] }} />
          {n.id}
        </A3>
      ))}

      {/* 04 · evolução */}
      <A3 state="evolucao" pos={[-0.75, 0.1, 0.35]} delay={0.8} className="h3d-tag h3d-dim">sem. 6 — sono estabiliza</A3>
      <A3 state="evolucao" pos={[0.23, 0.6, 0]} delay={1.4} className="h3d-tag h3d-dim">sem. 14 — retoma o trabalho</A3>
      <A3 state="evolucao" pos={[1.66, 1.35, -0.3]} delay={2.0} className="h3d-tag">sem. 22 — objetivo concluído</A3>

      {/* 05 · prontuário */}
      <A3 state="prontuario" pos={[-0.5, 1.05, 0]} delay={0.3} className="h3d-head" align="left">Evolução da sessão</A3>
      <A3 state="prontuario" pos={[-0.5, 0.31, 0]} delay={1.6} className="h3d-head" align="left">Hipóteses clínicas</A3>
      <A3 state="prontuario" pos={[-0.5, -0.43, 0]} delay={3.0} className="h3d-head" align="left">Plano terapêutico</A3>
      <A3 state="prontuario" pos={[1.2, 1.42, 0]} delay={0.9} className="h3d-chip3d">gerado automaticamente · você revisa</A3>

      {/* 06 · vídeo */}
      <A3 state="video" pos={[0, -1.5, 0]} delay={1.2} className="h3d-gas">transcrição em tempo real</A3>
    </div>
  )
}

/* ticker de frases do grafo (fora do espaço 3D — overlay fixo) */
export function TemasQuoteTicker({ scenes, active }: { scenes: any; active: boolean }) {
  const quotes = (scenes && scenes.quotes) || []
  const timing = (scenes && scenes.quoteTiming) || { start: 1.3, step: 3.4, dur: 1.3, transDur: 3.5 }
  const [qi, setQi] = React.useState(-1)
  React.useEffect(() => {
    if (!active) { setQi(-1); return }
    const timers: any[] = []
    const base = timing.transDur * 0.5
    quotes.forEach((_: any, fi: number) => {
      const showAt = (base + timing.start + fi * timing.step) * 1000
      const hideAt = showAt + 5300
      timers.push(setTimeout(() => setQi(fi), showAt))
      timers.push(setTimeout(() => setQi((cur) => (cur === fi ? -1 : cur)), hideAt))
    })
    return () => timers.forEach(clearTimeout)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!active || qi < 0) return null
  return (
    <div className="h3d-ticker-wrap">
      <div key={qi} className="h3d-ticker-quote">{quotes[qi]}</div>
    </div>
  )
}

/* ── 03 · objetivos — dashboard "realista" (cards de métricas + gráfico) ── */
const OBJ_METRICS = [
  { label: 'Autoestima', meta: 'GAS · escala −2...+2', color: '#b07d40', val: 68, target: 75 },
  { label: 'Regulação da ansiedade', meta: 'freq. semanal', color: '#6a4ec8', val: 55, target: 70 },
  { label: 'Higiene do sono', meta: 'noites/semana', color: '#5a9e8a', val: 48, target: 65 },
]
const OBJ_CHART = {
  humor: [18, 22, 20, 28, 34, 30, 40, 46, 44, 52],
  aberto: [10, 14, 24, 30, 26, 36, 32, 42, 48, 54],
  marcos: [3, 6, 8],
}
function objChartPath(vals: number[], w: number, h: number) {
  const max = 60, n = vals.length
  return vals.map((v, i) => `${i ? 'L' : 'M'} ${(i / (n - 1)) * w} ${h - (v / max) * h}`).join(' ')
}

export function ObjDashboard({ active }: { active: boolean }) {
  const [on, setOn] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    setOn(false)
    setVisible(false)
    if (!active) return
    const showT = setTimeout(() => setVisible(true), 90)
    const onT = setTimeout(() => setOn(true), 160)
    return () => { clearTimeout(showT); clearTimeout(onT) }
  }, [active])
  if (!active) return null
  const w = 220, h = 74
  return (
    <div className={'h3d-objdash-wrap' + (visible ? ' show' : '')}>
      <div className={'h3d-objdash' + (on ? ' on' : '')}>
        <div className="h3d-od-card">
          <span className="h3d-od-badge amber">OBJETIVOS · SMART + GAS</span>
          <div className="h3d-od-title">Objetivos Terapêuticos</div>
          {OBJ_METRICS.map((m, i) => (
            <div className="h3d-od-row" key={m.label} style={{ transitionDelay: (0.5 + i * 0.7) + 's' }}>
              <div className="h3d-od-row-top">
                <span>{m.label}</span>
                <span className="h3d-od-meta">{m.meta}</span>
              </div>
              <div className="h3d-od-bar-track">
                <div className="h3d-od-bar-fill" style={{ width: (on ? m.val : 0) + '%', background: m.color, transitionDelay: (0.7 + i * 0.7) + 's' }} />
                <div className="h3d-od-bar-tick" style={{ left: m.target + '%' }} />
              </div>
              <div className="h3d-od-row-foot">
                <span>baseline</span>
                <b style={{ color: m.color }}>{m.val}%</b>
                <span>alvo {m.target}%</span>
              </div>
            </div>
          ))}
          <p className="h3d-od-foot-note">Métrica, baseline, alvo e prazo — a posição atual em relação ao alvo, sessão após sessão.</p>
        </div>
        <div className="h3d-od-card">
          <span className="h3d-od-badge violet">EVOLUÇÃO · LONGITUDINAL</span>
          <div className="h3d-od-title">Evolução Registrada</div>
          <svg className="h3d-od-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <path d={objChartPath(OBJ_CHART.humor, w, h)} pathLength="1" className="h3d-od-line humor"
              style={{ strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, transitionDelay: '2.8s' }} />
            <path d={objChartPath(OBJ_CHART.aberto, w, h)} pathLength="1" className="h3d-od-line aberto"
              style={{ strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, transitionDelay: '3.6s' }} />
            {OBJ_CHART.marcos.map((k) => {
              const x = (k / (OBJ_CHART.humor.length - 1)) * w
              const y = h - (OBJ_CHART.humor[k] / 60) * h
              return <circle key={k} cx={x} cy={y} r="2.6" className="h3d-od-marker" />
            })}
          </svg>
          <div className="h3d-od-legend">
            <span><i className="humor" />humor</span>
            <span><i className="aberto" />abertura</span>
            <span><i className="marco" />marco extraído</span>
          </div>
          <p className="h3d-od-foot-note">Humor, ritmo, presença e abertura ao longo do processo. Marcos extraídos automaticamente das sessões anteriores.</p>
        </div>
      </div>
    </div>
  )
}
