'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { Turno } from './TranscriptionCard'

/**
 * Mini-grafo ao vivo. Extrai palavras de >4 chars dos turnos,
 * conta frequência, e desenha bolinhas + arestas simples por co-ocorrência.
 * Fundo orgânico via classe themes-card no parent. §7.
 */

const STOPWORDS = new Set([
  'para','como','isso','aquilo','minha','meu','também','muito','mais','sobre','quando','porque',
  'então','mesmo','assim','depois','tinha','tenho','estar','estou','sendo','sempre','nunca',
  'aqui','agora','ainda','você','vocês','dele','dela','quero','quase','algum','alguma','sentir',
  'tive','consegui','conseguir',
])

type Node = { word: string; count: number; x: number; y: number }

export function ThemesCanvas({ turnos }: { turnos: Turno[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const nodes = useMemo(() => buildNodes(turnos), [turnos])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    if (nodes.length === 0) {
      ctx.fillStyle = 'rgba(0,0,0,.25)'
      ctx.font = '11px DM Sans, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Os temas aparecerão aqui à medida que a conversa for transcrita.', W / 2, H / 2)
      return
    }

    // arestas (pseudo: liga nó ao centro)
    ctx.strokeStyle = 'rgba(106,78,200,.15)'
    ctx.lineWidth = 1
    nodes.forEach(n => {
      ctx.beginPath()
      ctx.moveTo(W / 2, H / 2)
      ctx.lineTo(n.x, n.y)
      ctx.stroke()
    })

    // nós
    nodes.forEach(n => {
      const r = 8 + Math.min(16, n.count * 3)
      ctx.fillStyle = 'rgba(106,78,200,.18)'
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(106,78,200,.95)'
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.55, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'var(--ink-soft)'
      ctx.fillStyle = '#1a1825'
      ctx.font = '11px DM Sans, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(n.word, n.x, n.y + r + 12)
    })
  }, [nodes])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={220}
      style={{ width: '100%', height: 220 }}
    />
  )
}

function buildNodes(turnos: Turno[]): Node[] {
  const counts: Record<string, number> = {}
  turnos.forEach(t => {
    t.texto.toLowerCase()
      .replace(/[.,;:!?()"]/g, '')
      .split(/\s+/)
      .forEach(w => {
        if (w.length < 5 || STOPWORDS.has(w)) return
        counts[w] = (counts[w] ?? 0) + 1
      })
  })
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count], i, arr): Node => {
      const angle = (i / arr.length) * Math.PI * 2
      const radius = 70 + Math.random() * 20
      return {
        word, count,
        x: 260 + Math.cos(angle) * radius,
        y: 110 + Math.sin(angle) * radius,
      }
    })
  return top
}
