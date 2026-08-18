'use client'
/* Hero — copy à ESQUERDA (sobre um scrim de leitura, full-bleed), fluxo de 6
   blocos nomeados (01 Preparar → 06 Videochamada) morfando SINCRONIZADO com as
   cenas 3D. Dois níveis: 6 blocos de COPY × 7 cenas do ENGINE — "Evoluir" cobre
   objetivos→evolução (o dashboard de objetivos e depois a linha de evolução).
   Cada cena tem seu próprio dwell; o grafo (Conectar) segura ~34s de propósito —
   é o herói da análise clínica e precisa de tempo pra ser absorvido.
   CTA + intro persistentes (clareza P1 preservada mesmo com as headlines ciclando). */
import React, { useState, useEffect, useRef } from 'react'
import { Hero3D } from './hero-3d'
import { HeroSand } from './hero-sand'

/* Intro — só o nome "audere". O único espiral é o GRANDE (partículas 3D), que
   nasce logo depois do nome. Sem espiral HTML aqui. */
function HeroIntro({ exploded }: { exploded: boolean }) {
  return (
    <div className={'hero-intro' + (exploded ? ' gone' : '')} aria-hidden="true">
      <div className="hero-intro-name serif">audere</div>
      <div className="hero-intro-sub">inteligência clínica longitudinal</div>
    </div>
  )
}

type Sect = { num: string; name: string; keys: string[]; title: React.ReactNode; sub: string; at: { left: string; top: string } }

/* 6 blocos de COPY. `keys` = cenas do engine que o bloco cobre (Evoluir cobre 2). */
const SECTIONS: Sect[] = [
  { num: '01', name: 'Preparar', keys: ['preparar'], at: { left: '61%', top: '12%' },
    title: <>Chegue <em>preparado</em>.</>,
    sub: 'Antes do atendimento começar, a Audere recupera o que importa do caso — objetivos ativos, temas que voltaram, o que mudou desde a última vez.' },
  { num: '02', name: 'Acompanhar', keys: ['sessoes'], at: { left: '84%', top: '26%' },
    title: <>Sua atenção <em>permanece no paciente</em>.</>,
    sub: 'Enquanto a conversa acontece, o registro corre sozinho e o histórico aparece só quando importa — os temas que reaparecem, o contexto de quando surgiram antes.' },
  { num: '03', name: 'Conectar', keys: ['temas'], at: { left: '88%', top: '60%' },
    title: <>É assim que nasce a <em>continuidade clínica</em>.</>,
    sub: 'Depois de meses, os registros isolados viram uma visão contínua: cada tema recorrente vira um nó, e as conexões mostram o que anda junto — o mapa que nenhuma memória segura sozinha.' },
  { num: '04', name: 'Evoluir', keys: ['objetivos', 'evolucao'], at: { left: '70%', top: '88%' },
    title: <>Cada atendimento <em>fortalece o acompanhamento</em>.</>,
    sub: 'Depois da sessão, tudo passa a enriquecer a história do paciente — objetivos, evolução, padrões e a linha do tempo se atualizam sozinhos.' },
  { num: '05', name: 'Prontuário', keys: ['prontuario'], at: { left: '42%', top: '82%' },
    title: <>O prontuário <em>se escreve sozinho</em>.</>,
    sub: 'Documentação clínica gerada automaticamente a partir de cada sessão. Sempre rascunho, até você revisar e assinar.' },
  { num: '06', name: 'Videochamada', keys: ['video'], at: { left: '40%', top: '14%' },
    title: <>Atenda. A Audere <em>acompanha</em>.</>,
    sub: 'Videochamada integrada, com registro contínuo do que importa. O histórico mora onde o atendimento acontece.' },
]

/* sequência plana das cenas do engine */
const SEQ = ['preparar', 'sessoes', 'temas', 'objetivos', 'evolucao', 'prontuario', 'video']
/* dwell por cena — o grafo (temas) segura muito mais tempo, de propósito */
const DWELL: Record<string, number> = { preparar: 14000, sessoes: 13000, temas: 34000, objetivos: 13000, evolucao: 12000, prontuario: 13000, video: 11000 }
/* cenas em modo escuro (mesmas do engine: temas, evolucao, video) */
const DARK = new Set(['temas', 'evolucao', 'video'])
/* mapa cena → índice do bloco de copy */
const KEY_SECTION: Record<string, number> = {}
SECTIONS.forEach((sc, si) => sc.keys.forEach((k) => { KEY_SECTION[k] = si }))

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export function Hero() {
  const [seqIdx, setSeqIdx] = useState(0)         // índice na sequência plana (0..6)
  const [born, setBorn] = useState(false)         // o espiral grande (3D) nasce após o nome
  const [exploded, setExploded] = useState(false) // intro sai, copy revela, fluxo começa
  const reduce = useRef(false)
  useEffect(() => { reduce.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }, [])

  // Coreografia: "audere" aparece → o espiral grande (3D) nasce (~0,9s) → segura →
  // explode (~3,6s): intro sai, copy revela, o 3D deixa 'spiral' e entra no fluxo.
  useEffect(() => {
    const r = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setBorn(true), r ? 0 : 900)
    const t2 = setTimeout(() => setExploded(true), r ? 0 : 3600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const curKey = SEQ[seqIdx]

  // auto-ciclo: reprograma ao mudar de cena, com o dwell da cena atual
  useEffect(() => {
    if (!exploded || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setSeqIdx((i) => (i + 1) % SEQ.length), DWELL[curKey] || 12000)
    return () => clearTimeout(t)
  }, [seqIdx, exploded, curKey])

  const sectionIdx = KEY_SECTION[curKey] ?? 0
  const s = SECTIONS[sectionIdx]
  const dark = DARK.has(curKey)
  const goSection = (i: number) => { const j = SEQ.indexOf(SECTIONS[i].keys[0]); if (j >= 0) setSeqIdx(j) }

  return (
    <header id="topo" className={'h3d' + (dark ? ' h3d-dark' : '') + ' h3d-live' + (exploded ? ' h3d-exploded' : '')}>
      {/* o único espiral: o GRANDE das partículas 3D (full-bleed). Nasce após o nome
          (born); fica na cena 'spiral' durante a intro, depois entra no fluxo */}
      <div className={'hero-v2-3dslot' + (born ? ' d3d-in' : '')} aria-hidden="true">
        <Hero3D seqKey={exploded ? curKey : 'spiral'} />
      </div>

      {/* scrim de leitura: gradiente à esquerda que mantém a copy legível sobre a
          animação full-bleed (adapta claro/escuro). Some no lado direito, onde as
          cenas e as tags respiram. */}
      <div className="h3d-scrim" aria-hidden="true" />

      {/* intro: só o nome "audere" (o espiral é o grande, do 3D) */}
      <HeroIntro exploded={exploded} />

      <div className="h3d-copy">
        <div className="h3d-eyebrow">
          <span className="h3d-num" key={'n' + sectionIdx}>{s.num}</span>
          <span className="h3d-sep" />
          <span key={'e' + sectionIdx} className="h3d-eyename">{s.name}</span>
        </div>
        <h1 className="serif h3d-title" key={'t' + sectionIdx}>{s.title}</h1>
        <p className="h3d-sub" key={'s' + sectionIdx}>{s.sub}</p>
        <div className="h3d-cta">
          <button className="btn-lp btn-lp-primary" onClick={() => scrollTo('acesso')}>Comece grátis →</button>
          <button className="btn-lp btn-lp-ghost" onClick={() => scrollTo('plataforma')}>Explorar a plataforma</button>
        </div>
        <div className="hero-v2-reassure">Grátis para começar · <strong>sem cartão, sem fidelidade</strong></div>
        {!reduce.current && <div className="h3d-prog" key={'p' + seqIdx} style={{ ['--dwell' as any]: ((DWELL[curKey] || 12000) / 1000) + 's' }}><span /></div>}
      </div>

      {/* areia da continuidade — quando o passo muda, a pill anterior se desmancha
          e a areia viaja num arco até a próxima parada (substitui a linha do ciclo) */}
      <HeroSand leftPct={parseFloat(s.at.left)} topPct={parseFloat(s.at.top)} dark={dark} active={exploded} />

      {/* órbita — os 6 blocos como conceito ao redor da cena 3D (clicáveis) */}
      <div className="h3d-orbit">
        {SECTIONS.map((st, i) => (
          <button key={st.num} className={'h3d-lab' + (i === sectionIdx ? ' on' : '')}
            style={{ left: st.at.left, top: st.at.top }} onClick={() => goSection(i)}>
            <span className="h3d-lab-num">{st.num}</span> {st.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* chips de navegação dos 6 blocos (clicáveis) */}
      <div className="h3d-chips">
        {SECTIONS.map((st, i) => (
          <button key={st.num} className={'h3d-chip' + (i === sectionIdx ? ' on' : '')} onClick={() => goSection(i)}>
            {st.name}
          </button>
        ))}
      </div>
    </header>
  )
}
