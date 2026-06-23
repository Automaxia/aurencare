'use client'

import { useState } from 'react'
import type { SparkPonto } from '@/server/services/evolucao'

/**
 * Sparklines do perfil de evolução com legenda + hover por ponto.
 * Cada ponto = uma sessão assinada (ordem cronológica). O hover mostra o
 * nº da sessão, a data e o valor formatado por tipo (humor ou voz).
 */

type Kind = 'humor' | 'voz'

const W = 220
const H = 44

export function EvolucaoSparks({ humor, ritmo }: { humor: SparkPonto[]; ritmo: SparkPonto[] }) {
  const temHumor = humor.length >= 2
  const temRitmo = ritmo.length >= 2
  if (!temHumor && !temRitmo) return null

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
      }}
    >
      {temHumor ? (
        <SparkChart
          kind="humor"
          title="Humor ao longo do tempo"
          legenda="Estado emocional relatado a cada sessão, de −5 (desagradável) a +5 (agradável)."
          pts={humor}
          color="var(--accent)"
          showDots
        />
      ) : <div />}
      {temRitmo ? (
        <SparkChart
          kind="voz"
          title="Voz do paciente"
          legenda="Quanto do tempo de fala foi do paciente (vs. psicólogo) em cada sessão."
          pts={ritmo}
          color="var(--sage)"
        />
      ) : <div />}
    </div>
  )
}

function SparkChart({ kind, title, legenda, pts, color, showDots }: {
  kind: Kind; title: string; legenda: string; pts: SparkPonto[]; color: string; showDots?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const valores = pts.map(p => p.v)
  const t = tendencia(valores)

  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const range = max - min || 1
  const stepX = W / Math.max(1, pts.length - 1)
  const coords = pts.map((p, i) => ({
    x: i * stepX,
    y: H - ((p.v - min) / range) * H,
    pt: p,
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${W} ${H} L 0 ${H} Z`

  const ativo = hover != null ? coords[hover] : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 500 }}>{title}</span>
        <span
          title={`Tendência: comparação da média recente com a anterior (${t.delta > 0 ? '+' : ''}${t.delta})`}
          style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', cursor: 'help' }}
        >
          {t.seta} {t.delta > 0 ? '+' : ''}{t.delta} · últ.: <strong style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{formatValor(kind, pts[pts.length - 1].v)}</strong>
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Tooltip */}
        {ativo && (
          <div
            style={{
              position: 'absolute', zIndex: 5, pointerEvents: 'none',
              left: `${(ativo.x / W) * 100}%`,
              bottom: `calc(${(1 - ativo.y / H) * 100}% + 10px)`,
              transform: 'translateX(-50%)',
              background: 'var(--ink)', color: 'white', borderRadius: 8,
              padding: '6px 9px', fontSize: 11, lineHeight: 1.4, whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(0,0,0,.22)',
            }}
          >
            <div style={{ fontWeight: 600 }}>Sessão {ativo.pt.n} · {formatData(ativo.pt.data)}</div>
            <div style={{ opacity: .85 }}>{formatValor(kind, ativo.pt.v)}</div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
          role="img" aria-label={title}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <path d={area} fill={color} opacity={0.12} />
          <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* linha-guia do ponto ativo */}
          {ativo && <line x1={ativo.x} y1={0} x2={ativo.x} y2={H} stroke={color} strokeWidth="1" opacity={0.25} vectorEffect="non-scaling-stroke" />}
          {/* pontos visíveis (opcional) */}
          {showDots && coords.map((c, i) => (
            <circle key={`d${i}`} cx={c.x} cy={c.y} r="1.8" fill={color} opacity={hover === i ? 0 : 1} />
          ))}
          {/* ponto ativo destacado */}
          {ativo && <circle cx={ativo.x} cy={ativo.y} r="3.4" fill={color} stroke="white" strokeWidth="1.5" />}
          {/* hit-areas amplas pra hover confortável */}
          {coords.map((c, i) => (
            <rect
              key={`h${i}`}
              x={c.x - stepX / 2} y={-6} width={stepX} height={H + 12}
              fill="transparent" style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(h => (h === i ? null : h))}
            />
          ))}
        </svg>
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.5, marginTop: 7 }}>
        {legenda} <span style={{ color: 'var(--muted)' }}>Cada ponto é uma sessão — passe o mouse para ver os detalhes.</span>
      </div>
    </div>
  )
}

function formatValor(kind: Kind, v: number): string {
  if (kind === 'voz') return `${Math.round(v)}% do tempo de fala`
  // humor: -5..+5
  const n = Math.round(v * 10) / 10
  return `${n > 0 ? '+' : ''}${n} · ${formatEstadoLabel(v)}`
}

function formatEstadoLabel(estado: number): string {
  if (estado >= 3) return 'agradável'
  if (estado >= 1) return 'levemente agradável'
  if (estado <= -3) return 'desagradável'
  if (estado <= -1) return 'levemente desagradável'
  return 'neutro'
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

/** Tendência: compara a janela recente com a anterior. */
function tendencia(valores: number[], janela = 4): { seta: string; delta: number } {
  if (valores.length < 2) return { seta: '→', delta: 0 }
  const n = valores.length
  const j = Math.min(janela, Math.max(1, Math.floor(n / 2)))
  const recente = valores.slice(-j)
  const anterior = valores.slice(0, n - j)
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const delta = avg(recente) - (anterior.length ? avg(anterior) : recente[0])
  const d = Math.round(delta * 10) / 10
  return { seta: Math.abs(d) < 0.1 ? '→' : d > 0 ? '↑' : '↓', delta: d }
}
