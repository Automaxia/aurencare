'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { GrafoDados, GrafoNode } from '@/server/services/temas'
import { CLUSTER_COLORS } from './view'

/**
 * Canvas force-directed conforme §8.
 * Física: repulsão 2600/d², mola (d-105)*0.004, gravidade 0.003, amortecimento 0.82.
 * Bloom glow ao selecionar nó · arestas com opacity ∝ weight.
 */

type SimNode = GrafoNode & { x: number; y: number; vx: number; vy: number; r: number }

type Props = {
  grafo: GrafoDados
  selecionado: GrafoNode | null
  onSelect: (n: GrafoNode | null) => void
}

export function GrafoCanvas({ grafo, selecionado, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>()
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const nodes = useMemo<SimNode[]>(() => {
    const W = 800, H = 500
    return grafo.nodes.map((n, i) => ({
      ...n,
      r: 6 + Math.min(20, n.frequencia * 1.4),
      x: W / 2 + Math.cos((i / grafo.nodes.length) * Math.PI * 2) * 180 + (Math.random() - .5) * 30,
      y: H / 2 + Math.sin((i / grafo.nodes.length) * Math.PI * 2) * 140 + (Math.random() - .5) * 30,
      vx: 0, vy: 0,
    }))
  }, [grafo.nodes])

  const edgeIndex = useMemo(() => {
    const map = new Map<string, number>()
    nodes.forEach((n, i) => map.set(n.palavra, i))
    return grafo.edges
      .map(e => ({ ia: map.get(e.a), ib: map.get(e.b), w: e.weight }))
      .filter((e): e is { ia: number; ib: number; w: number } => e.ia !== undefined && e.ib !== undefined)
  }, [nodes, grafo.edges])

  /** Map palavra → Set de palavras vizinhas (acesso O(1) durante render). */
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of grafo.edges) {
      if (!m.has(e.a)) m.set(e.a, new Set())
      if (!m.has(e.b)) m.set(e.b, new Set())
      m.get(e.a)!.add(e.b)
      m.get(e.b)!.add(e.a)
    }
    return m
  }, [grafo.edges])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect()
      canvas.width = width * devicePixelRatio
      canvas.height = height * devicePixelRatio
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const maxWeight = Math.max(1, ...edgeIndex.map(e => e.w))

    let selected = selecionado?.palavra ?? null

    canvas.onclick = (ev) => {
      const rect = canvas.getBoundingClientRect()
      const mx = (ev.clientX - rect.left) * devicePixelRatio
      const my = (ev.clientY - rect.top) * devicePixelRatio
      let hit: SimNode | null = null
      for (const n of nodes) {
        const dx = n.x * devicePixelRatio - mx
        const dy = n.y * devicePixelRatio - my
        if (Math.hypot(dx, dy) <= (n.r + 6) * devicePixelRatio) { hit = n; break }
      }
      selected = hit?.palavra ?? null
      onSelect(hit)
    }

    const step = () => {
      const W = canvas.width / devicePixelRatio
      const H = canvas.height / devicePixelRatio
      const cx = W / 2, cy = H / 2

      // physics
      for (const n of nodes) {
        let fx = 0, fy = 0
        // gravidade
        fx += (cx - n.x) * 0.003
        fy += (cy - n.y) * 0.003
        // repulsão
        for (const o of nodes) {
          if (o === n) continue
          const dx = n.x - o.x, dy = n.y - o.y
          const d2 = Math.max(36, dx * dx + dy * dy)
          const f = 2600 / d2
          fx += (dx / Math.sqrt(d2)) * f
          fy += (dy / Math.sqrt(d2)) * f
        }
        n.vx = (n.vx + fx) * 0.82
        n.vy = (n.vy + fy) * 0.82
      }
      // molas das arestas
      for (const e of edgeIndex) {
        const a = nodes[e.ia], b = nodes[e.ib]
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.max(1, Math.hypot(dx, dy))
        const spring = (d - 105) * 0.004 * (0.5 + e.w / maxWeight)
        const ux = dx / d, uy = dy / d
        a.vx += ux * spring
        a.vy += uy * spring
        b.vx -= ux * spring
        b.vy -= uy * spring
      }
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        // clamp
        n.x = Math.max(20, Math.min(W - 20, n.x))
        n.y = Math.max(20, Math.min(H - 20, n.y))
      }

      // render
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // ── Quando há nó selecionado, destacar rede de relações ──
      // connected = selected + vizinhos diretos
      const selNeighbors = selected ? (neighbors.get(selected) ?? new Set<string>()) : null
      const isConnected = (palavra: string) =>
        !selected || palavra === selected || selNeighbors!.has(palavra)
      const edgeTouchesSelected = (a: string, b: string) =>
        selected != null && (a === selected || b === selected)

      // ── arestas ──
      for (const e of edgeIndex) {
        const a = nodes[e.ia], b = nodes[e.ib]
        const baseAlpha = 0.06 + (e.w / maxWeight) * 0.32

        let strokeStyle: string
        let lineWidth = 0.5 + (e.w / maxWeight) * 1.5
        if (selected == null) {
          strokeStyle = `rgba(180, 170, 230, ${baseAlpha})`
        } else if (edgeTouchesSelected(a.palavra, b.palavra)) {
          // aresta conectada ao selecionado — destaque
          const other = a.palavra === selected ? b : a
          const color = CLUSTER_COLORS[other.cluster] ?? '#aaa'
          strokeStyle = color + 'cc'        // ~80% opacity
          lineWidth = 1.4 + (e.w / maxWeight) * 2
        } else {
          // aresta não relacionada — fade out
          strokeStyle = `rgba(180, 170, 230, ${baseAlpha * 0.2})`
        }
        ctx.strokeStyle = strokeStyle
        ctx.lineWidth = lineWidth
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }

      // ── nodes ──
      for (const n of nodes) {
        const color = CLUSTER_COLORS[n.cluster] ?? '#888'
        const isSel = selected === n.palavra
        const isConn = isConnected(n.palavra)
        const dim = selected != null && !isConn
        const opacityMul = dim ? 0.18 : 1

        // bloom glow no selecionado
        if (isSel) {
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5)
          grd.addColorStop(0, color + 'aa')
          grd.addColorStop(.5, color + '44')
          grd.addColorStop(1, color + '00')
          ctx.fillStyle = grd
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2); ctx.fill()
        }
        // anel pra vizinhos diretos (não selecionado, mas connected)
        if (selected != null && isConn && !isSel) {
          ctx.strokeStyle = color + 'aa'
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.stroke()
        }

        // halo suave + núcleo (com dim quando aplicável)
        ctx.globalAlpha = opacityMul
        ctx.fillStyle = color + '33'
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()

        // label
        const labelAlpha = dim ? 0.18 : (isSel ? 0.98 : isConn ? 0.85 : 0.62)
        ctx.globalAlpha = labelAlpha
        ctx.fillStyle = 'rgba(255,255,255,1)'
        ctx.font = `${isSel ? 14 : isConn ? 12 : 11}px DM Sans, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(n.palavra, n.x, n.y + n.r + 14)
        ctx.globalAlpha = 1
      }

      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [nodes, edgeIndex, neighbors, onSelect, selecionado])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'pointer' }} />
    </div>
  )
}
