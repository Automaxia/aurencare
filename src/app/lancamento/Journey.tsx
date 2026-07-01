'use client'

import { AnimatedGrafo, AnimatedEvolucao } from './EvolDemos'

/**
 * Jornada da continuidade — unifica as seções antes isoladas (o que a Audere
 * lembra, grafo, objetivos, evolução, durante a sessão) numa ÚNICA história em 4
 * pilares: Preparar · Acompanhar · Conectar · Evoluir. Timeline premium, revela
 * no scroll (usa .lp-reveal, observado pelo RevealObserver da página).
 */

type Etapa = {
  n: number; verbo: string; id?: string; head: string; copy: string; msg?: string; visual: React.ReactNode
}

const ETAPAS: Etapa[] = [
  {
    n: 1, verbo: 'Preparar', id: 'observar',
    head: 'Chegue preparado.',
    copy: 'Antes do atendimento começar, a Audere recupera o que importa do caso — objetivos ativos, temas que voltaram, o que mudou desde a última vez.',
    msg: 'Sem reconstruir de memória meses de acompanhamento.',
    visual: <PreparoCard />,
  },
  {
    n: 2, verbo: 'Acompanhar', id: 'sessao',
    head: 'Sua atenção permanece no paciente.',
    copy: 'Enquanto a conversa acontece, o registro corre sozinho e o histórico aparece só quando importa — temas que reaparecem, o contexto de quando surgiram antes.',
    msg: 'A tecnologia trabalha em silêncio, sem competir pela sua atenção.',
    visual: <SessaoCard />,
  },
  {
    n: 3, verbo: 'Conectar',
    head: 'Cada atendimento fortalece o acompanhamento.',
    copy: 'Depois da sessão, tudo passa a enriquecer a história do paciente — objetivos, evolução, padrões e a linha do tempo se atualizam sozinhos.',
    visual: <div className="jt-card"><AnimatedEvolucao /></div>,
  },
  {
    n: 4, verbo: 'Evoluir',
    head: 'É assim que nasce a continuidade clínica.',
    copy: 'Depois de meses, os registros isolados viram uma visão contínua: padrões que se repetem, recaídas, temas que se conectam ao longo do processo.',
    msg: 'O tratamento deixa de depender da memória — passa a ser acompanhado com contexto.',
    visual: <div className="jt-card jt-card-graph"><div className="jt-card-lbl">Temas conectados ao longo do tratamento</div><AnimatedGrafo /></div>,
  },
]

export function JornadaContinuidade() {
  return (
    <section id="continuidade" className="jt">
      <div className="lp-wrap jt-head lp-reveal">
        <div className="jt-eyebrow">A jornada da continuidade</div>
        <h2 className="jt-title">A Audere acompanha todo o ciclo clínico —<br />não apenas uma sessão.</h2>
      </div>

      <div className="lp-wrap jt-track">
        {ETAPAS.map(e => (
          <div key={e.n} id={e.id} className="jt-stage lp-reveal">
            <span className="jt-node">{e.n}</span>
            <div className="jt-verb">{e.verbo}</div>
            <h3 className="jt-head3">{e.head}</h3>
            <p className="jt-copy">{e.copy}</p>
            {e.msg && <p className="jt-msg">{e.msg}</p>}
            <div className="jt-visual">{e.visual}</div>
          </div>
        ))}
      </div>

      <Styles />
    </section>
  )
}

// ─── Visual · Preparar (painel de contexto pré-sessão) ─────────────────
const PREP = [
  { ic: '◬', cor: 'var(--accent)', tx: <>Objetivo <strong>Autoestima</strong> · +18%</> },
  { ic: '❝', cor: 'var(--rose)', tx: <>Tema <strong>&ldquo;mãe&rdquo;</strong> voltou · 3ª sessão</> },
  { ic: '↗', cor: 'var(--sage)', tx: <>Humor em alta há <strong>4 sessões</strong></> },
  { ic: '◔', cor: 'var(--muted)', tx: <>Última sessão há <strong>12 dias</strong></> },
]
function PreparoCard() {
  return (
    <div className="jt-panel" style={{ maxWidth: 460 }}>
      <div className="jt-panel-h">
        <span className="jt-panel-name">Marina K. <span>· antes da sessão 8</span></span>
        <span className="jt-panel-pill">contexto recuperado</span>
      </div>
      <ul className="jt-signals">
        {PREP.map((s, i) => (
          <li key={i} className="jt-signal">
            <span className="jt-ic" style={{ color: s.cor, background: `color-mix(in srgb, ${s.cor} 12%, transparent)` }}>{s.ic}</span>
            <span>{s.tx}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Visual · Acompanhar (sessão ao vivo) ──────────────────────────────
function SessaoCard() {
  return (
    <div className="jt-panel" style={{ maxWidth: 560 }}>
      <div className="jt-panel-h">
        <span className="jt-panel-name">Fernanda K. <span>· Sessão 7</span></span>
        <span className="jt-panel-pill jt-live"><i />registro ao vivo</span>
      </div>
      <div className="jt-sess">
        <div className="jt-chat">
          <Bolha who="P">Como você se sentiu na semana?</Bolha>
          <Bolha who="C" flag>Foi difícil. Voltou a vontade de sumir.</Bolha>
          <Bolha who="P">Quando isso voltou?</Bolha>
        </div>
        <div className="jt-side">
          <div className="jt-w">
            <span className="jt-w-lbl">Temas ao vivo</span>
            <div className="jt-chips">{['trabalho', 'cansaço', 'sumir'].map(t => <span key={t}>{t}</span>)}</div>
          </div>
          <div className="jt-w">
            <span className="jt-w-lbl">Histórico</span>
            <div className="jt-hist">&ldquo;sumir&rdquo; já apareceu na sessão 4</div>
          </div>
        </div>
      </div>
    </div>
  )
}
function Bolha({ who, children, flag }: { who: 'P' | 'C'; children: React.ReactNode; flag?: boolean }) {
  return (
    <div className={`jt-bub ${who === 'P' ? 'p' : 'c'}`} style={flag ? { borderLeft: '2.5px solid var(--rose)' } : undefined}>
      <b>{who}</b>{children}
    </div>
  )
}

function Styles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .jt { padding:84px 0; border-top:1px solid var(--border); background:var(--surface); }
      .jt-head { text-align:center; max-width:780px; }
      .jt-eyebrow { font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--accent); margin-bottom:14px; }
      .jt-title { font-family:var(--font-display), serif; font-weight:300; font-size:clamp(28px,3.6vw,44px); line-height:1.14; letter-spacing:-.012em; color:#291860; margin:0; }

      .jt-track { position:relative; max-width:880px; margin:56px auto 0; padding-left:60px; }
      .jt-track::before { content:""; position:absolute; left:19px; top:14px; bottom:80px; width:2px;
        background:linear-gradient(var(--accent), var(--sage)); opacity:.22; }
      .jt-stage { position:relative; padding-bottom:64px; }
      .jt-stage:last-child { padding-bottom:0; }
      .jt-node { position:absolute; left:-60px; top:-4px; width:40px; height:40px; border-radius:50%;
        background:var(--card); border:2px solid var(--accent); color:var(--accent);
        display:flex; align-items:center; justify-content:center; font-family:var(--font-display), serif; font-weight:600; font-size:16px; }
      .jt-verb { font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:600; color:var(--accent); }
      .jt-head3 { font-family:var(--font-display), serif; font-weight:300; font-size:clamp(24px,2.8vw,34px);
        color:#291860; line-height:1.16; letter-spacing:-.01em; margin:8px 0 12px; text-wrap:balance; }
      .jt-copy { font-size:16px; color:var(--ink-soft); line-height:1.62; max-width:560px; margin:0; font-weight:300; }
      .jt-msg { font-size:14.5px; color:var(--accent); font-weight:500; margin:12px 0 0; max-width:560px; line-height:1.5; }
      .jt-visual { margin-top:24px; }

      .jt-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:20px 22px; box-shadow:0 8px 34px rgba(26,24,37,.05); }
      .jt-card-graph { max-width:520px; }
      .jt-card-lbl { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--faint); margin-bottom:8px; }

      .jt-panel { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:18px 20px; box-shadow:0 14px 40px -18px rgba(41,24,96,.25); }
      .jt-panel-h { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
      .jt-panel-name { font-size:15px; font-weight:600; color:var(--ink); }
      .jt-panel-name span { font-weight:400; color:var(--muted); font-size:12.5px; }
      .jt-panel-pill { font-size:10px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--accent); background:rgba(106,78,200,.10); padding:4px 9px; border-radius:999px; white-space:nowrap; }
      .jt-panel-pill.jt-live { color:var(--rose); background:rgba(196,96,122,.10); display:inline-flex; align-items:center; gap:5px; }
      .jt-panel-pill.jt-live i { width:6px; height:6px; border-radius:50%; background:var(--rose); animation:jtBlink 1.4s infinite; }
      .jt-signals { list-style:none; margin:0; padding:0; display:grid; gap:9px; }
      .jt-signal { display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:11px; background:var(--surface); border:1px solid var(--border); font-size:13.5px; color:var(--ink-soft); }
      .jt-signal strong { color:var(--ink); font-weight:600; }
      .jt-ic { flex:none; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; }

      .jt-sess { display:grid; grid-template-columns:1.3fr 1fr; gap:14px; }
      .jt-chat { display:grid; gap:7px; align-content:start; }
      .jt-bub { font-size:12.5px; line-height:1.4; padding:8px 11px; border-radius:10px; color:var(--ink-soft); }
      .jt-bub b { font-weight:700; margin-right:6px; }
      .jt-bub.p { background:rgba(106,78,200,.08); } .jt-bub.p b { color:var(--accent); }
      .jt-bub.c { background:rgba(90,158,138,.10); } .jt-bub.c b { color:var(--sage); }
      .jt-side { display:grid; gap:10px; align-content:start; }
      .jt-w { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:9px 11px; }
      .jt-w-lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
      .jt-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
      .jt-chips span { font-size:10.5px; font-weight:500; color:var(--accent); background:rgba(106,78,200,.10); padding:2px 8px; border-radius:999px; }
      .jt-hist { font-size:12px; color:var(--ink-soft); margin-top:5px; line-height:1.4; }

      @keyframes jtBlink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
      @media (max-width:640px) {
        .jt-track { padding-left:44px; }
        .jt-node { left:-44px; width:34px; height:34px; font-size:14px; }
        .jt-track::before { left:16px; }
        .jt-sess { grid-template-columns:1fr; }
      }
    ` }} />
  )
}
