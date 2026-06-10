'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Turno } from './TranscriptionCard'

/**
 * Mini-grafo ao vivo dos temas da sessão.
 *
 * Dois modos (toggle no header):
 * - "Agora" (recent): janela deslizante de 15min, peso por decay
 *   exponencial — temas recentes dominam, antigos fadeam. Default.
 *   Top 14 termos.
 * - "Sessão toda" (all): acumulado puro até 24 termos. Visão macro.
 *
 * Sessões de 1h não entopem mais o canvas porque o modo padrão
 * empurra termos antigos pra fora à medida que coisas novas surgem.
 *
 * Física força-dirigida leve + cores por cluster heurístico
 * (mesma da @/server/services/temas).
 */

const STOPWORDS = new Set([
  'para','como','isso','aquilo','minha','meu','também','muito','mais','sobre','quando','porque',
  'então','mesmo','assim','depois','tinha','tenho','estar','estou','sendo','sempre','nunca',
  'aqui','agora','ainda','você','vocês','dele','dela','quero','quase','algum','alguma','sentir',
  'tive','consegui','conseguir','está','estão','este','esta','esse','essa','aquele','aquela',
  'porque','porquê','sobre','sobretudo','onde','quem','qual','quais','foram','foi','sou','será',
  'seja','seria','têm','tem','sem','com','por','dos','das','nos','nas','pela','pelo',
])

type Cluster = 'emocional' | 'relacional' | 'situacional' | 'cognitivo'
type Mode = 'recent' | 'all'

const CLUSTER_COLOR: Record<Cluster, string> = {
  emocional:   '#7d63d6',
  relacional:  '#d27a92',
  situacional: '#6fb19c',
  cognitivo:   '#c89968',
}

const SEEDS: Record<Cluster, string[]> = {
  emocional: ['medo','ansiedade','ansioso','ansiosa','tristeza','triste','raiva','culpa','vergonha','alegria','feliz','irritação','frustração','solidão','vazio','calma','tranquilo','euforia','pânico','tensão','tenso','emoção','sentimento','sofrimento'],
  relacional: ['mãe','pai','filho','filha','irmão','irmã','marido','esposa','namorado','namorada','parceiro','parceira','amigo','amiga','colega','chefe','equipe','família','casamento','relacionamento','vínculo','briga','conflito'],
  situacional: ['trabalho','emprego','reunião','apresentação','prova','escola','faculdade','viagem','mudança','casa','dinheiro','rotina','agenda','prazo','projeto','férias','crise','médico'],
  cognitivo: ['pensamento','ideia','lembrança','memória','reflexão','decisão','escolha','dúvida','crença','padrão','padrões','perspectiva','autocrítica','planejamento','foco','atenção','perfeccionismo','ruminação'],
}

function inferirCluster(palavra: string): Cluster {
  for (const c of Object.keys(SEEDS) as Cluster[]) {
    if (SEEDS[c].includes(palavra)) return c
  }
  if (/^(senti|emo|raiv|trist|med|alegr|ang|cult|vergonh|frust|ansi|calm|tens|euf)/.test(palavra)) return 'emocional'
  if (/^(mãe|pai|filh|irmã|maridã|esposa|namora|amig|coleg|chefe|famíl|relação|vínc|briga|confl)/.test(palavra)) return 'relacional'
  if (/^(trabalh|reuni|apresent|escola|facul|prov|viagem|casa|dinheir|rotin|prazo|projet|consult|méd|hosp)/.test(palavra)) return 'situacional'
  return 'cognitivo'
}

type SimNode = {
  word: string
  weight: number     // peso (count puro no modo "all", count*decay no modo "recent")
  cluster: Cluster
  x: number; y: number
  vx: number; vy: number
  r: number
  appearedAt: number   // pulse de entrada
  fadingOut: boolean   // marcado pra remoção — fade-out antes de sumir
  fadeStart: number
}

const CANVAS_HEIGHT = 380
const TOP_RECENT = 14
const TOP_ALL = 24
const RECENT_WINDOW_MS = 15 * 60 * 1000   // 15min
const DECAY_HALF_LIFE_MS = 5 * 60 * 1000  // peso cai pela metade a cada 5min
const FADE_OUT_MS = 1200

export function ThemesCanvas({ turnos, emptyHint }: { turnos: Turno[]; emptyHint?: string }) {
  const [mode, setMode] = useState<Mode>('recent')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>()
  const simRef = useRef<Map<string, SimNode>>(new Map())

  const wordWeights = useMemo(() => buildWordWeights(turnos, mode), [turnos, mode])
  const [updateTick, setUpdateTick] = useState(0)

  useEffect(() => {
    const sim = simRef.current
    const W = canvasRef.current?.clientWidth ?? 400
    const H = canvasRef.current?.clientHeight ?? CANVAS_HEIGHT

    const limit = mode === 'recent' ? TOP_RECENT : TOP_ALL
    const top = Array.from(wordWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
    const topSet = new Set(top.map(([w]) => w))

    const now = performance.now()

    // marca pra fade-out o que saiu do top
    for (const [word, n] of sim.entries()) {
      if (!topSet.has(word) && !n.fadingOut) {
        n.fadingOut = true
        n.fadeStart = now
      }
    }
    // remove os que já passaram do tempo de fade-out
    for (const [word, n] of Array.from(sim.entries())) {
      if (n.fadingOut && now - n.fadeStart > FADE_OUT_MS) sim.delete(word)
    }

    // adiciona/atualiza top atual
    top.forEach(([word, weight], i) => {
      const existing = sim.get(word)
      if (existing) {
        existing.weight = weight
        existing.fadingOut = false   // ressuscita se voltou pro top
      } else {
        const angle = (i / top.length) * Math.PI * 2
        sim.set(word, {
          word, weight,
          cluster: inferirCluster(word),
          x: W / 2 + Math.cos(angle) * 100 + (Math.random() - .5) * 24,
          y: H / 2 + Math.sin(angle) * 80 + (Math.random() - .5) * 24,
          vx: 0, vy: 0,
          r: 4 + Math.min(16, weight * 2),
          appearedAt: now,
          fadingOut: false,
          fadeStart: 0,
        })
      }
    })
    setUpdateTick(t => t + 1)
  }, [wordWeights, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const resize = () => {
      const { width } = wrap.getBoundingClientRect()
      canvas.width = width * devicePixelRatio
      canvas.height = CANVAS_HEIGHT * devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = CANVAS_HEIGHT + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      const sim = simRef.current
      const nodes = Array.from(sim.values())
      const W = canvas.width / devicePixelRatio
      const H = canvas.height / devicePixelRatio
      const cx = W / 2, cy = H / 2

      // física: gravidade central + repulsão entre nós
      for (const n of nodes) {
        let fx = 0, fy = 0
        fx += (cx - n.x) * 0.005
        fy += (cy - n.y) * 0.005
        for (const o of nodes) {
          if (o === n) continue
          const dx = n.x - o.x, dy = n.y - o.y
          const d2 = Math.max(36, dx * dx + dy * dy)
          const f = 1100 / d2
          fx += (dx / Math.sqrt(d2)) * f
          fy += (dy / Math.sqrt(d2)) * f
        }
        n.vx = (n.vx + fx) * 0.84
        n.vy = (n.vy + fy) * 0.84
        n.r = 4 + Math.min(16, n.weight * 2)
      }
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        n.x = Math.max(22, Math.min(W - 22, n.x))
        n.y = Math.max(18, Math.min(H - 22, n.y))
      }

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, W, H)

      if (nodes.length === 0) {
        // Estado vazio é renderizado como overlay HTML (quebra linha melhor).
      } else {
        // arestas
        ctx.strokeStyle = 'rgba(122,117,144,.18)'
        ctx.lineWidth = 0.7
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j]
            const alphaMul = nodeAlpha(a) * nodeAlpha(b)
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            if (d < 100) {
              ctx.globalAlpha = Math.max(0, 1 - d / 100) * 0.45 * alphaMul
              ctx.beginPath()
              ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1

        const now = performance.now()
        for (const n of nodes) {
          const color = CLUSTER_COLOR[n.cluster]
          const alpha = nodeAlpha(n, now)
          if (alpha <= 0) continue
          ctx.globalAlpha = alpha

          const sinceAppear = now - n.appearedAt
          const newPulse = sinceAppear < 1500 ? (1 - sinceAppear / 1500) : 0

          if (newPulse > 0) {
            ctx.fillStyle = color + Math.round(newPulse * 64).toString(16).padStart(2, '0')
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (3 + newPulse * 2), 0, Math.PI * 2); ctx.fill()
          }
          ctx.fillStyle = color + '30'
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = color
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'rgba(26,24,37,.78)'
          ctx.font = '11px DM Sans, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(n.word, n.x, n.y + n.r + 12)
        }
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [updateTick])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 2,
        padding: '0 6px 6px', fontSize: 11,
      }}>
        <button
          type="button"
          onClick={() => setMode('recent')}
          style={modeBtnStyle(mode === 'recent')}
          title="Temas dos últimos 15min com mais peso"
        >
          Agora
        </button>
        <button
          type="button"
          onClick={() => setMode('all')}
          style={modeBtnStyle(mode === 'all')}
          title="Acumulado da sessão inteira"
        >
          Sessão toda
        </button>
      </div>
      <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: CANVAS_HEIGHT }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        {wordWeights.size === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            padding: '0 24px', textAlign: 'center', pointerEvents: 'none',
            fontSize: 12, lineHeight: 1.5, color: 'var(--muted)',
          }}>
            <span>{emptyHint ?? 'Os temas aparecerão aqui conforme a conversa for transcrita.'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 9px',
    border: '1px solid var(--border)',
    borderRadius: 999,
    background: active ? 'rgba(106,78,200,.10)' : 'transparent',
    color: active ? '#391d96' : 'var(--muted)',
    fontWeight: active ? 500 : 400,
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'background .15s, color .15s',
  }
}

function nodeAlpha(n: SimNode, now: number = performance.now()): number {
  if (!n.fadingOut) return 1
  const elapsed = now - n.fadeStart
  return Math.max(0, 1 - elapsed / FADE_OUT_MS)
}

/**
 * Constrói peso por palavra.
 * - mode='recent': decay exponencial sobre os últimos 15min. Turnos
 *   fora da janela contam 0. Cada turno contribui peso = 2^(-Δt/halfLife).
 * - mode='all': contagem pura sem decay.
 */
function buildWordWeights(turnos: Turno[], mode: Mode): Map<string, number> {
  const weights = new Map<string, number>()
  const now = Date.now()
  for (const t of turnos) {
    let factor = 1
    if (mode === 'recent') {
      const age = now - (Date.parse(t.ts) || now)
      if (age > RECENT_WINDOW_MS) continue
      factor = Math.pow(0.5, age / DECAY_HALF_LIFE_MS)
    }
    const tokens = t.texto.toLowerCase()
      .replace(/[.,;:!?()"…“”‘’\-]/g, ' ')
      .split(/\s+/)
    for (const w of tokens) {
      if (w.length < 5 || STOPWORDS.has(w)) continue
      weights.set(w, (weights.get(w) ?? 0) + factor)
    }
  }
  return weights
}
