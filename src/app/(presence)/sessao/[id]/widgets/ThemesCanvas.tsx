'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Turno } from './TranscriptionCard'

/**
 * Mini-grafo ao vivo. Atualiza automaticamente conforme novos turnos
 * chegam — sem refresh. Física força-dirigida leve + cores por cluster
 * (heurística simples mesma de @/server/services/temas).
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
  count: number
  cluster: Cluster
  x: number; y: number
  vx: number; vy: number
  r: number
  appearedAt: number   // timestamp pra animar entrada (pulse glow)
}

export function ThemesCanvas({ turnos }: { turnos: Turno[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>()
  const simRef = useRef<Map<string, SimNode>>(new Map())   // persiste posições entre renders

  // Recalcula contagem das palavras ao receber turnos novos
  const wordCounts = useMemo(() => buildWordCounts(turnos), [turnos])
  const [updateTick, setUpdateTick] = useState(0)

  // Sincroniza simRef com wordCounts (adiciona novos / atualiza count / remove sumidas)
  useEffect(() => {
    const sim = simRef.current
    const W = canvasRef.current?.clientWidth ?? 400
    const H = canvasRef.current?.clientHeight ?? 200

    // Top N
    const top = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    const topSet = new Set(top.map(([w]) => w))

    // remove os que não estão mais no top
    for (const word of Array.from(sim.keys())) {
      if (!topSet.has(word)) sim.delete(word)
    }

    // adiciona/atualiza
    const now = performance.now()
    top.forEach(([word, count], i) => {
      const existing = sim.get(word)
      if (existing) {
        existing.count = count
      } else {
        const angle = (i / top.length) * Math.PI * 2
        sim.set(word, {
          word, count,
          cluster: inferirCluster(word),
          x: W / 2 + Math.cos(angle) * 80 + (Math.random() - .5) * 20,
          y: H / 2 + Math.sin(angle) * 60 + (Math.random() - .5) * 20,
          vx: 0, vy: 0,
          r: 4 + Math.min(14, count * 2),
          appearedAt: now,
        })
      }
    })
    setUpdateTick(t => t + 1)   // dispara animation loop
  }, [wordCounts])

  // Animation loop — física + render contínuo
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect()
      const h = Math.max(140, height)
      canvas.width = width * devicePixelRatio
      canvas.height = h * devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = h + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      const sim = simRef.current
      const nodes = Array.from(sim.values())
      const W = canvas.width / devicePixelRatio
      const H = canvas.height / devicePixelRatio
      const cx = W / 2, cy = H / 2

      // física simples (similar ao GrafoCanvas mas leve)
      for (const n of nodes) {
        let fx = 0, fy = 0
        fx += (cx - n.x) * 0.006
        fy += (cy - n.y) * 0.006
        for (const o of nodes) {
          if (o === n) continue
          const dx = n.x - o.x, dy = n.y - o.y
          const d2 = Math.max(36, dx * dx + dy * dy)
          const f = 800 / d2
          fx += (dx / Math.sqrt(d2)) * f
          fy += (dy / Math.sqrt(d2)) * f
        }
        n.vx = (n.vx + fx) * 0.82
        n.vy = (n.vy + fy) * 0.82
        n.r = 4 + Math.min(14, n.count * 2)
      }
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        n.x = Math.max(20, Math.min(W - 20, n.x))
        n.y = Math.max(16, Math.min(H - 20, n.y))
      }

      // render
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, W, H)

      if (nodes.length === 0) {
        ctx.fillStyle = 'rgba(122,117,144,.45)'
        ctx.font = '11px DM Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Os temas aparecerão aqui conforme a conversa for transcrita.', W / 2, H / 2)
      } else {
        // arestas — liga aos vizinhos mais próximos (heuristic)
        ctx.strokeStyle = 'rgba(122,117,144,.18)'
        ctx.lineWidth = 0.7
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j]
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            if (d < 90) {
              ctx.globalAlpha = Math.max(0, 1 - d / 90) * 0.5
              ctx.beginPath()
              ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
            }
          }
        }
        ctx.globalAlpha = 1

        // nós
        const now = performance.now()
        for (const n of nodes) {
          const color = CLUSTER_COLOR[n.cluster]
          const sinceAppear = now - n.appearedAt
          const newPulse = sinceAppear < 1500 ? (1 - sinceAppear / 1500) : 0  // glow fade-out

          // halo (pulso)
          if (newPulse > 0) {
            ctx.fillStyle = color + Math.round(newPulse * 64).toString(16).padStart(2, '0')
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (3 + newPulse * 2), 0, Math.PI * 2); ctx.fill()
          }
          // halo permanente suave
          ctx.fillStyle = color + '30'
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.fill()
          // core sólido
          ctx.fillStyle = color
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
          // label
          ctx.fillStyle = 'rgba(26,24,37,.78)'
          ctx.font = '11px DM Sans, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(n.word, n.x, n.y + n.r + 12)
        }
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
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: 220 }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}

function buildWordCounts(turnos: Turno[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of turnos) {
    const tokens = t.texto.toLowerCase()
      .replace(/[.,;:!?()"…“”‘’\-]/g, ' ')
      .split(/\s+/)
    for (const w of tokens) {
      if (w.length < 5 || STOPWORDS.has(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  return counts
}
