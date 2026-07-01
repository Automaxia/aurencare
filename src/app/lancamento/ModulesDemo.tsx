'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Grade de módulos da infraestrutura — cada card traz uma mini-recriação
 * ANIMADA da funcionalidade (agenda preenchendo, WhatsApp confirmando, barras
 * de financeiro subindo, assinatura desenhando…). O RAF só roda quando a seção
 * está visível (useInView) — zero custo fora da tela.
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c) }
function seg(t: number, inStart: number, inDur: number, outStart: number, outDur: number) {
  const a = ease((t - inStart) / inDur)
  const b = 1 - ease((t - outStart) / (outDur || 0.6))
  return Math.max(0, Math.min(a, b))
}

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
    return () => {
      cancelAnimationFrame(raf.current)
      if (base.current != null) acc.current += (performance.now() - base.current) / 1000
      base.current = null
    }
  }, [active])
  return t
}

// ── Demos ──────────────────────────────────────────────────────────────
function DemoAgenda({ t }: { t: number }) {
  const cols = ['seg', 'ter', 'qua', 'qui', 'sex']
  const blocks = [
    { c: 0, top: 14, h: 26 }, { c: 1, top: 40, h: 26 }, { c: 1, top: 70, h: 22 },
    { c: 2, top: 22, h: 30 }, { c: 3, top: 50, h: 26 }, { c: 4, top: 16, h: 24 }, { c: 4, top: 60, h: 26 },
  ]
  const drop = Math.floor((t / 2.4) % blocks.length)
  return (
    <div className="d-agenda">
      {cols.map((c, i) => (
        <div className="dag-col" key={c}>
          <div className="dag-day">{c}</div>
          <div className="dag-slots">
            {blocks.filter(b => b.c === i).map((b, j) => {
              const isNew = blocks.indexOf(b) === drop
              return <span key={j} className={'dag-block' + (isNew ? ' new' : '')} style={{ top: b.top + '%', height: b.h + '%' }} />
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DemoCobranca({ t }: { t: number }) {
  const rows = [{ m: 'PIX', v: 'R$ 180' }, { m: 'Crédito', v: 'R$ 180' }, { m: 'PIX', v: 'R$ 220' }]
  const paidUntil = Math.floor((t / 1.4) % (rows.length + 2))
  return (
    <div className="d-cob">
      {rows.map((r, i) => {
        const paid = i < paidUntil
        return (
          <div className="dcob-row" key={i}>
            <span className="dcob-m">{r.m}</span>
            <span className="dcob-v">{r.v}</span>
            <span className={'dcob-st' + (paid ? ' paid' : '')}>{paid ? '✓ pago' : 'pendente'}</span>
          </div>
        )
      })}
    </div>
  )
}

function DemoFinanceiro({ t }: { t: number }) {
  const heights = [40, 58, 50, 72, 66, 88]
  const grow = ease(clamp01(((t % 5) / 5) / 0.7))
  const total = Math.round(2400 + 5800 * grow)
  return (
    <div className="d-fin">
      <div className="dfin-bars">
        {heights.map((h, i) => <span key={i} className="dfin-bar" style={{ height: h * grow + '%' }} />)}
      </div>
      <div className="dfin-total">R$ {total.toLocaleString('pt-BR')}<span>recebido no mês</span></div>
    </div>
  )
}

function DemoTranscricao({ t }: { t: number }) {
  const words = 'voltou a vontade de sumir depois da reunião'.split(' ')
  const n = Math.floor((t * 2.4) % (words.length + 4))
  return (
    <div className="d-trans">
      <div className="dtr-wave">
        {Array.from({ length: 22 }).map((_, i) => <span key={i} style={{ height: 20 + 70 * Math.abs(Math.sin(t * 3 + i * 0.5)) + '%' }} />)}
      </div>
      <div className="dtr-text">{words.slice(0, n).join(' ')}<span className="dtr-caret" /></div>
    </div>
  )
}

function DemoResumo({ t }: { t: number }) {
  const lines = [92, 84, 96, 70]
  const p = (t % 6) / 6
  return (
    <div className="d-res">
      <div className="dres-tag">rascunho</div>
      {lines.map((w, i) => {
        const fill = ease(clamp01((p - i * 0.12) / 0.35))
        return <div className="dres-line" key={i} style={{ width: w + '%' }}><span style={{ width: fill * 100 + '%' }} /></div>
      })}
    </div>
  )
}

function DemoProntuario({ t }: { t: number }) {
  const p = (t % 5.5) / 5.5
  const sign = ease(clamp01((p - 0.55) / 0.35))
  const stamp = clamp01((p - 0.92) / 0.08)
  return (
    <div className="d-pront">
      <div className="dpr-doc">
        <div className="dpr-h" />
        <div className="dpr-l" style={{ width: '90%' }} />
        <div className="dpr-l" style={{ width: '78%' }} />
        <div className="dpr-l" style={{ width: '85%' }} />
        <svg className="dpr-sign" viewBox="0 0 120 40" fill="none">
          <path d="M 6 30 C 20 6 28 36 40 18 C 50 4 56 34 70 20 C 82 8 96 30 114 14" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - sign} />
        </svg>
      </div>
      <span className="dpr-stamp" style={{ opacity: stamp, transform: `scale(${0.8 + stamp * 0.2}) rotate(-8deg)` }}>assinado</span>
    </div>
  )
}

function DemoVideo({ t }: { t: number }) {
  return (
    <div className="d-video">
      <div className="dvid-tile">
        <div className="dvid-avatar" />
        <div className="dvid-self" />
        <div className="dvid-bars">
          {Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ height: 30 + 60 * Math.abs(Math.sin(t * 4 + i)) + '%' }} />)}
        </div>
        <span className="dvid-timer">42:18</span>
      </div>
      <div className="dvid-note">link por sessão · válido 4h · vídeo nunca gravado</div>
    </div>
  )
}

function DemoSecretaria({ t }: { t: number }) {
  const msgs = [
    { who: 'out', tx: 'Olá Marina! Sua sessão é amanhã 18h 🌿', at: 0.4 },
    { who: 'out', tx: 'Confirma presença?', at: 1.8 },
    { who: 'in', tx: 'Confirmo!', at: 3.4 },
    { who: 'out', tx: '✓ Confirmado. Até lá!', at: 4.6 },
  ]
  const L = 7
  const lt = t % L
  return (
    <div className="d-sec">
      {msgs.map((m, i) => {
        const o = seg(lt, m.at, 0.4, L - 0.6, 0.6)
        return <div key={i} className={'dsec-b ' + m.who} style={{ opacity: o, transform: `translateY(${(1 - o) * 6}px)` }}>{m.tx}</div>
      })}
    </div>
  )
}

type Mod = { id: string; name: string; kind: string; desc: string; Demo: (p: { t: number }) => React.ReactElement }
const MODULES: Mod[] = [
  { id: 'agenda',     name: 'Agenda',                kind: 'núcleo',   desc: 'Sessões avulsas e séries recorrentes. Dia, semana e mês — com conflitos detectados antes do envio.', Demo: DemoAgenda },
  { id: 'transc',     name: 'Transcrição com IA',    kind: 'clínico',  desc: 'O registro acontece sozinho durante a sessão. Áudio processado e descartado em segundos.', Demo: DemoTranscricao },
  { id: 'resumos',    name: 'Resumos & observações', kind: 'clínico',  desc: 'Resumo de cada sessão em linguagem observacional — sempre rascunho, até você revisar.', Demo: DemoResumo },
  { id: 'pront',      name: 'Prontuários',           kind: 'clínico',  desc: 'Nenhuma nota vira prontuário sem a sua leitura e assinatura. Histórico estruturado e seu.', Demo: DemoProntuario },
  { id: 'video',      name: 'Videochamada nativa',   kind: 'núcleo',   desc: 'Atendimento online embutido, com termo CFP 11/2018. Link por sessão, válido por 4h.', Demo: DemoVideo },
  { id: 'cobranca',   name: 'Cobranças',             kind: 'operação', desc: 'PIX, crédito e débito em ambiente seguro. Lembretes e baixa automática de cada sessão.', Demo: DemoCobranca },
  { id: 'financeiro', name: 'Financeiro',            kind: 'operação', desc: 'O valor das sessões cai direto na sua conta. Acompanhe recebimentos e fluxo num painel.', Demo: DemoFinanceiro },
  { id: 'secretaria', name: 'Secretária virtual',    kind: 'operação', desc: 'Confirmações, lembretes e pós-sessão pelo WhatsApp. O paciente nunca instala nada.', Demo: DemoSecretaria },
]
// Hierarquia visual: 3 grupos em vez de 8 cards de peso igual (menos carga).
const GRUPOS = [
  { label: 'Atendimento', ids: ['agenda', 'secretaria', 'video'] },
  { label: 'Registro clínico', ids: ['transc', 'resumos', 'pront'] },
  { label: 'Gestão', ids: ['cobranca', 'financeiro'] },
]
const byId = (id: string) => MODULES.find(m => m.id === id)!

export function ModulesGrid() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  return (
    <div className="mod-grid" ref={ref}>
      {GRUPOS.map(g => (
        <div key={g.label} className="mod-group">
          <div className="mod-grouplbl">{g.label}</div>
          <div className="mod-row">
            {g.ids.map(id => byId(id)).map(m => (
              <div className="mod-card" key={m.id}>
                <div className="mod-demo">{vis ? <m.Demo t={t} /> : null}</div>
                <div className="mod-meta">
                  <h3>{m.name}</h3>
                  <p>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <ModStyles />
    </div>
  )
}

function ModStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .mod-grid { display:flex; flex-direction:column; gap:34px; margin-top:38px; }
      .mod-grouplbl { font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:var(--muted); margin-bottom:16px; padding-bottom:11px; border-bottom:1px solid var(--border); }
      .mod-row { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
      .mod-card { background:var(--card); border:1px solid var(--border); border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 4px 22px rgba(26,24,37,.04); transition:transform .25s, box-shadow .25s; }
      .mod-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(26,24,37,.09); }
      .mod-demo { height:120px; background:var(--card-warm, var(--surface)); border-bottom:1px solid var(--border); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:16px; }
      .mod-meta { padding:16px 20px 20px; }
      .mod-meta h3 { font-family:var(--font-display), serif; font-weight:400; font-size:22px; color:var(--ink); margin:0 0 7px; letter-spacing:-.3px; }
      .mod-meta p { font-size:13.5px; line-height:1.5; color:var(--muted); font-weight:300; margin:0; }
      @media (max-width:900px) { .mod-row { grid-template-columns:repeat(2,1fr); } }
      @media (max-width:560px) { .mod-row { grid-template-columns:1fr; } }

      .d-agenda { display:flex; gap:5px; width:100%; height:100%; }
      .dag-col { flex:1; display:flex; flex-direction:column; }
      .dag-day { font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:var(--faint); text-align:center; margin-bottom:5px; }
      .dag-slots { position:relative; flex:1; background:rgba(26,24,37,.03); border-radius:4px; }
      .dag-block { position:absolute; left:2px; right:2px; background:rgba(106,78,200,.55); border-radius:3px; transition:all .4s; }
      .dag-block.new { background:var(--accent); box-shadow:0 0 10px rgba(106,78,200,.6); }
      .d-cob { width:100%; display:flex; flex-direction:column; gap:8px; }
      .dcob-row { display:flex; align-items:center; gap:8px; font-size:13px; background:rgba(26,24,37,.03); padding:7px 11px; border-radius:8px; }
      .dcob-m { color:var(--ink-soft); font-weight:500; }
      .dcob-v { margin-left:auto; color:var(--muted); }
      .dcob-st { font-size:11px; font-weight:600; color:var(--muted); padding:3px 9px; border-radius:12px; background:rgba(26,24,37,.06); transition:all .4s; }
      .dcob-st.paid { color:#fff; background:var(--sage); }
      .d-fin { display:flex; align-items:flex-end; gap:14px; width:100%; height:100%; padding:6px 4px; }
      .dfin-bars { display:flex; align-items:flex-end; gap:5px; height:100%; flex:1; }
      .dfin-bar { flex:1; background:linear-gradient(180deg,var(--amber),rgba(176,125,64,.5)); border-radius:3px 3px 0 0; transition:height .12s; min-height:4px; }
      .dfin-total { font-family:var(--font-display), serif; font-size:22px; color:#391d96; display:flex; flex-direction:column; line-height:1.1; }
      .dfin-total span { font-family:inherit; font-size:10px; color:var(--muted); margin-top:3px; }
      .d-trans { width:100%; }
      .dtr-wave { display:flex; align-items:center; gap:3px; height:40px; margin-bottom:10px; }
      .dtr-wave span { flex:1; background:var(--accent); border-radius:2px; opacity:.7; }
      .dtr-text { font-size:13px; color:var(--ink-soft); line-height:1.4; min-height:34px; }
      .dtr-caret { display:inline-block; width:2px; height:13px; background:var(--accent); margin-left:2px; vertical-align:middle; animation:modBlink 1s infinite; }
      .d-res { width:100%; position:relative; display:flex; flex-direction:column; gap:9px; padding-top:6px; }
      .dres-tag { position:absolute; top:-6px; right:0; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--amber); background:rgba(176,125,64,.12); padding:3px 9px; border-radius:12px; }
      .dres-line { height:8px; border-radius:4px; background:rgba(26,24,37,.06); overflow:hidden; }
      .dres-line span { display:block; height:100%; background:var(--accent); opacity:.55; border-radius:4px; transition:width .12s; }
      .d-pront { position:relative; width:100%; display:flex; justify-content:center; }
      .dpr-doc { width:78%; background:#fff; border:1px solid var(--border); border-radius:8px; padding:12px; box-shadow:0 4px 14px rgba(26,24,37,.06); position:relative; }
      .dpr-h { height:8px; width:50%; background:var(--accent); opacity:.7; border-radius:3px; margin-bottom:9px; }
      .dpr-l { height:5px; background:rgba(26,24,37,.1); border-radius:3px; margin-bottom:6px; }
      .dpr-sign { width:60px; height:24px; margin-top:6px; }
      .dpr-stamp { position:absolute; right:8px; bottom:8px; font-family:var(--font-display), serif; font-style:italic; font-size:16px; color:var(--sage); border:2px solid var(--sage); border-radius:8px; padding:2px 8px; }
      .d-video { width:100%; }
      .dvid-tile { position:relative; height:78px; border-radius:10px; background:linear-gradient(135deg,#2a2140,#1d1631); overflow:hidden; display:flex; align-items:center; justify-content:center; }
      .dvid-avatar { width:34px; height:34px; border-radius:50%; background:radial-gradient(circle at 40% 35%, #b9a6f5, #6a4ec8); }
      .dvid-self { position:absolute; right:7px; bottom:7px; width:24px; height:18px; border-radius:4px; background:linear-gradient(135deg,#5a9e8a,#3d6b5e); border:1.5px solid rgba(255,255,255,.3); }
      .dvid-bars { position:absolute; left:8px; bottom:8px; display:flex; align-items:flex-end; gap:2px; height:18px; }
      .dvid-bars span { width:2.5px; background:#7fcdb8; border-radius:2px; }
      .dvid-timer { position:absolute; left:8px; top:7px; font-size:10px; color:rgba(255,255,255,.8); font-weight:500; }
      .dvid-note { font-size:11px; color:var(--muted); margin-top:9px; text-align:center; }
      .d-sec { width:100%; display:flex; flex-direction:column; gap:6px; }
      .dsec-b { max-width:80%; font-size:12px; line-height:1.35; padding:7px 11px; border-radius:11px; transition:opacity .3s; }
      .dsec-b.out { background:#dcf3ea; color:#0b3d30; border-bottom-right-radius:3px; align-self:flex-end; }
      .dsec-b.in { background:rgba(26,24,37,.06); color:var(--ink-soft); border-bottom-left-radius:3px; align-self:flex-start; }
      @keyframes modBlink { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
    ` }} />
  )
}
