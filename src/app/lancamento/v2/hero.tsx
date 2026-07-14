'use client'
/* Hero — layout original restaurado: copy à ESQUERDA (não mistura com as
   animações à direita), fluxo de 6 estados nomeados (01 Preparar → 06
   Videochamada) morfando SINCRONIZADO com as cenas 3D. CTA + intro persistentes
   (clareza P1 preservada mesmo com as headlines ciclando). */
import React, { useState, useEffect, useRef } from 'react'
import { Hero3D } from './hero-3d'
import { DrawSpiral } from './core'

/* Intro — "audere" aparece e a espiral NASCE dele (desenha-se). Depois entrega
   para o 3D. Respeita reduced-motion (desenha na hora). */
function HeroIntro({ exploded }: { exploded: boolean }) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(1); return }
    let raf = 0
    const t0 = performance.now() + 650 // espera o nome aparecer, então desenha
    const tick = (now: number) => {
      const k = Math.max(0, (now - t0) / 1600)
      setP(k >= 1 ? 1 : k * k * (3 - 2 * k))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className={'hero-intro' + (exploded ? ' gone' : '')} aria-hidden="true">
      <div className="hero-intro-spiral"><DrawSpiral size={132} p={p} sw={1.5} color="var(--accent)" tip="var(--sage)" /></div>
      <div className="hero-intro-name serif">audere</div>
      <div className="hero-intro-sub">inteligência clínica longitudinal</div>
    </div>
  )
}

type St = { num: string; name: string; scene: string; dwell: number; dark?: boolean; title: React.ReactNode; sub: string; at: { left: string; top: string } }

const STATES: St[] = [
  { num: '01', name: 'Preparar', scene: 'preparar', dwell: 8000, at: { left: '61%', top: '12%' },
    title: <>Chegue <em>preparado</em>.</>,
    sub: 'Antes do atendimento começar, a Audere recupera o que importa do caso — objetivos ativos, temas que voltaram, o que mudou desde a última vez.' },
  { num: '02', name: 'Acompanhar', scene: 'sessoes', dwell: 8000, at: { left: '84%', top: '26%' },
    title: <>Sua atenção <em>permanece no paciente</em>.</>,
    sub: 'Enquanto a conversa acontece, o registro corre sozinho e o histórico aparece só quando importa — os temas que reaparecem, o contexto de quando surgiram antes.' },
  { num: '03', name: 'Conectar', scene: 'temas', dwell: 10000, dark: true, at: { left: '88%', top: '60%' },
    title: <>É assim que nasce a <em>continuidade clínica</em>.</>,
    sub: 'Depois de meses, os registros isolados viram uma visão contínua: padrões que se repetem, recaídas, temas que se conectam ao longo do processo.' },
  { num: '04', name: 'Evoluir', scene: 'evolucao', dwell: 8000, dark: true, at: { left: '70%', top: '88%' },
    title: <>Cada atendimento <em>fortalece o acompanhamento</em>.</>,
    sub: 'Depois da sessão, tudo passa a enriquecer a história do paciente — objetivos, evolução, padrões e a linha do tempo se atualizam sozinhos.' },
  { num: '05', name: 'Prontuário', scene: 'prontuario', dwell: 7000, at: { left: '42%', top: '82%' },
    title: <>O prontuário <em>se escreve sozinho</em>.</>,
    sub: 'Documentação clínica gerada automaticamente a partir de cada sessão. Sempre rascunho, até você revisar e assinar.' },
  { num: '06', name: 'Videochamada', scene: 'video', dwell: 7000, dark: true, at: { left: '40%', top: '14%' },
    title: <>Atenda. A Audere <em>acompanha</em>.</>,
    sub: 'Videochamada integrada, com registro contínuo do que importa. O histórico mora onde o atendimento acontece.' },
]

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/* caminho fechado ligando os 6 passos (nas mesmas coords % dos labels) → o ciclo */
const CYCLE_D = STATES.map((st, i) => (i ? 'L' : 'M') + parseFloat(st.at.left) + ' ' + parseFloat(st.at.top)).join(' ') + ' Z'

export function Hero() {
  const [idx, setIdx] = useState(0)
  const [drawn, setDrawn] = useState(false)     // espiral terminou de nascer → revela o 3D
  const [exploded, setExploded] = useState(false) // intro sai, copy revela, fluxo começa
  const reduce = useRef(false)
  useEffect(() => { reduce.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }, [])

  // Coreografia da intro: "audere" aparece → espiral nasce (~2,3s) → 3D assume a
  // espiral → explode (~3,7s): intro sai, copy revela, fluxo dos 6 passos começa.
  useEffect(() => {
    const r = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setDrawn(true), r ? 0 : 2300)
    const t2 = setTimeout(() => setExploded(true), r ? 0 : 3700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // auto-ciclo: reprograma ao mudar o estado, com o dwell do estado atual
  useEffect(() => {
    if (!exploded || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setIdx((i) => (i + 1) % STATES.length), STATES[idx].dwell)
    return () => clearTimeout(t)
  }, [idx, exploded])

  const s = STATES[idx]

  return (
    <header id="topo" className={'h3d' + (s.dark ? ' h3d-dark' : '') + ' h3d-live' + (exploded ? ' h3d-exploded' : '')}>
      {/* 3D só aparece quando a espiral "nasce" (drawn); antes segue a cena spiral,
          depois o fluxo dos 6 passos */}
      <div className={'hero-v2-3dslot' + (drawn ? ' d3d-in' : '')} aria-hidden="true">
        <Hero3D sceneKey={exploded ? s.scene : 'spiral'} />
      </div>

      {/* intro: "audere" aparece e a espiral nasce dele */}
      <HeroIntro exploded={exploded} />

      <div className="h3d-copy">
        <div className="h3d-eyebrow">
          <span className="h3d-num" key={'n' + idx}>{s.num}</span>
          <span className="h3d-sep" />
          <span key={'e' + idx} className="h3d-eyename">{s.name}</span>
        </div>
        <h1 className="serif h3d-title" key={'t' + idx}>{s.title}</h1>
        <p className="h3d-sub" key={'s' + idx}>{s.sub}</p>
        <div className="h3d-cta">
          <button className="btn-lp btn-lp-primary" onClick={() => scrollTo('acesso')}>Solicitar acesso antecipado →</button>
          <button className="btn-lp btn-lp-ghost" onClick={() => scrollTo('plataforma')}>Explorar a plataforma</button>
        </div>
        <div className="hero-v2-reassure">Beta por convite · <strong>sem mensalidade durante o beta</strong></div>
        {!reduce.current && <div className="h3d-prog" key={'p' + idx} style={{ ['--dwell' as any]: (s.dwell / 1000) + 's' }}><span /></div>}
      </div>

      {/* linha do ciclo — liga os 6 passos num loop fechado; o traço tracejado
          "flui" (stroke-dashoffset) dando a sensação de ciclo contínuo */}
      <svg className="h3d-cycle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={CYCLE_D} className="h3d-cycle-path" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* órbita — os 6 passos como conceito ao redor da cena 3D (clicáveis) */}
      <div className="h3d-orbit">
        {STATES.map((st, i) => (
          <button key={st.num} className={'h3d-lab' + (i === idx ? ' on' : '')}
            style={{ left: st.at.left, top: st.at.top }} onClick={() => setIdx(i)}>
            <span className="h3d-lab-num">{st.num}</span> {st.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* chips de navegação dos 6 estados (clicáveis) */}
      <div className="h3d-chips">
        {STATES.map((st, i) => (
          <button key={st.num} className={'h3d-chip' + (i === idx ? ' on' : '')} onClick={() => setIdx(i)}>
            {st.name}
          </button>
        ))}
      </div>
    </header>
  )
}
