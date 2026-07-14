'use client'
/* Seções C — Plataforma (8 módulos, cada card com mini-recriação animada) +
   Convergência (grafo de fontes → memória longitudinal).
   P4: grupos reordenados para LIDERAR com "Registro clínico" (os diferenciais),
   depois Atendimento, depois Gestão. */
import React from 'react'
import { Section, Eyebrow, Display, useInView, useRaf, ease, clamp01, seg } from './core'

/* ── Demos animadas (função pura de t) ── */
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
            {blocks.filter((b) => b.c === i).map((b, j) => {
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
        {Array.from({ length: 22 }).map((_, i) => {
          const h = 20 + 70 * Math.abs(Math.sin(t * 3 + i * 0.5))
          return <span key={i} style={{ height: h + '%' }} />
        })}
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
          <path d="M 6 30 C 20 6 28 36 40 18 C 50 4 56 34 70 20 C 82 8 96 30 114 14"
            stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - sign} />
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

type Mod = { id: string; name: string; desc: string; Demo: (p: { t: number }) => React.JSX.Element }
type Group = { label: string; kind: string; items: Mod[] }

/* P4 — "Registro clínico" (diferenciais) primeiro; depois Atendimento; depois Gestão. */
const PLATFORM_GROUPS: Group[] = [
  {
    label: 'Registro clínico', kind: 'clínico',
    items: [
      { id: 'transc', name: 'Registro inteligente', desc: 'A transcrição corre sozinha durante a sessão. Áudio processado e descartado em segundos.', Demo: DemoTranscricao },
      { id: 'resumos', name: 'Memória da sessão', desc: 'Um resumo que já sabe que o tema de hoje voltou pela terceira vez desde março. Sempre rascunho, até você revisar.', Demo: DemoResumo },
      { id: 'pront', name: 'Linha do tempo clínica', desc: 'Nenhuma nota vira prontuário sem a sua leitura e assinatura. Documentação que parte do que já se sabe do caso.', Demo: DemoProntuario },
    ],
  },
  {
    label: 'Atendimento', kind: 'núcleo',
    items: [
      { id: 'agenda', name: 'Agenda', desc: 'Sessões avulsas e séries recorrentes, com conflitos detectados antes do envio. O básico do consultório resolvido sem sair da Audere.', Demo: DemoAgenda },
      { id: 'secretaria', name: 'Secretária virtual', desc: 'Confirmações, lembretes e pós-sessão pelo WhatsApp. O paciente nunca instala nada.', Demo: DemoSecretaria },
      { id: 'video', name: 'Videochamada nativa', desc: 'Atendimento online embutido, com termo CFP 11/2018. A videochamada mora onde o histórico já está.', Demo: DemoVideo },
    ],
  },
  {
    label: 'Gestão', kind: 'operação',
    items: [
      { id: 'cobranca', name: 'Cobranças', desc: 'PIX, crédito e débito em ambiente seguro. O paciente clica um link, escolhe como pagar, e você nem precisa lembrar de cobrar.', Demo: DemoCobranca },
      { id: 'financeiro', name: 'Financeiro', desc: 'O valor das sessões cai direto na sua conta. Recebimentos e fluxo do consultório num painel.', Demo: DemoFinanceiro },
    ],
  },
]

export function ModulesSection() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  const kindClass = (k: string) => 'k-' + k.normalize('NFD').replace(/[^a-z]/gi, '')
  return (
    <Section id="plataforma">
      <Eyebrow color="var(--sage-text)">Integrado, não espalhado</Eyebrow>
      <Display size="clamp(30px,3.9vw,54px)" style={{ marginTop: 18, maxWidth: 980 }}>
        Tudo o que você precisa para cuidar do consultório. Tudo o que faltava para <em style={{ color: 'var(--accent)' }}>acompanhar o tratamento.</em>
      </Display>
      <p className="sec-lead">
        Vídeo, transcrição, objetivos e cobrança no mesmo lugar: uma assinatura no lugar de cinco,
        seus dados juntos em vez de espalhados.
      </p>
      <div ref={ref as any}>
        {PLATFORM_GROUPS.map((g) => (
          <div className="plat-group" key={g.label}>
            <div className="plat-sub">{g.label}</div>
            <div className="mod-grid mod-grid-3">
              {g.items.map((m) => (
                <div className="mod-card" key={m.id}>
                  <div className="mod-demo">{vis ? <m.Demo t={t} /> : null}</div>
                  <div className="mod-meta">
                    <span className={'mod-kind ' + kindClass(g.kind)}>{g.label}</span>
                    <h3>{m.name}</h3>
                    <p>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

const CONV_SOURCES = ['Agenda', 'Sessões', 'Transcrição', 'Prontuário', 'Objetivos', 'Financeiro', 'WhatsApp']

export function ConvergenceSection() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  return (
    <Section id="conecta" dark>
      <div className="conv-head">
        <Eyebrow color="#b9a6f5">É aqui que tudo se conecta</Eyebrow>
        <Display size="clamp(30px,3.9vw,54px)" color="#f4f1fb" style={{ marginTop: 18, maxWidth: 820 }}>
          O que ninguém mais <em style={{ color: '#b9a6f5' }}>conecta.</em>
        </Display>
        <p className="conv-lead">
          Depois de organizar toda a operação do consultório, a Audere conecta cada atendimento numa memória
          clínica longitudinal: é isso que transforma registros isolados em continuidade terapêutica.
        </p>
      </div>

      <div className="conv-diagram" ref={ref as any}>
        <div className="conv-sources">
          {CONV_SOURCES.map((s, i) => {
            const o = clamp01(t * 0.7 - i * 0.14)
            return <span className="conv-src" key={s} style={{ opacity: o, transform: `translateX(${(1 - o) * -12}px)` }}><i />{s}</span>
          })}
        </div>
        <div className="conv-mid">
          <svg viewBox="0 0 240 360" className="conv-lines" fill="none" preserveAspectRatio="none">
            {CONV_SOURCES.map((_, i) => {
              const y = 24 + i * ((360 - 48) / (CONV_SOURCES.length - 1))
              const d = `M 0 ${y} C 90 ${y}, 150 180, 240 180`
              const draw = clamp01(t * 0.5 - i * 0.09)
              return (
                <g key={i}>
                  <path d={d} stroke="rgba(185,166,245,.3)" strokeWidth={1.4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
                  {draw > 0.98 && (
                    <circle r={3.2} fill={i % 2 ? '#7fcdb8' : '#b9a6f5'}>
                      <animateMotion dur={(3 + i * 0.3) + 's'} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="conv-right">
          <div className="conv-hub" style={{ opacity: clamp01(t * 0.7 - 0.7), transform: `scale(${0.94 + clamp01(t * 0.7 - 0.7) * 0.06})` }}>
            <div className="conv-hub-title serif">Inteligência Clínica Longitudinal</div>
            <div className="conv-hub-sub">memória que acompanha todo o tratamento</div>
          </div>
          <div className="conv-out serif" style={{ opacity: clamp01(t * 0.7 - 1.2) }}>Continuidade terapêutica</div>
        </div>
      </div>

      <p className="conv-close serif">
        A tecnologia cuida do contexto. <em>O psicólogo cuida da pessoa.</em>
      </p>
    </Section>
  )
}
