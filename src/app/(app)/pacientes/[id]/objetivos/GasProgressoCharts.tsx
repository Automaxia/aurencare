'use client'

import { useState } from 'react'
import type { GasEscala } from '@/server/services/gasObjetivos'

/**
 * Gráficos x,y de acompanhamento das metas GAS de UM objetivo:
 *  1. Pontuação de Progresso (T-Score) — agrega TODAS as metas num único score
 *     ao longo do tempo, com faixas (acima ≥60 / esperado 50 / abaixo ≤40).
 *  2. Evolução Longitudinal por Meta — uma linha por meta (níveis −2…+2).
 *
 * T-Score = método Kiresuk-Sherman (GAS), pesos iguais:
 *   T = 50 + 10·Σxᵢ / √(0,7·k + 0,3·k²)   (xᵢ = nível −2..+2, k = nº de metas)
 */

const COLORS = ['#6a4ec8', '#5a9e8a', '#c4607a', '#b07d40', '#3d6b9e', '#8a6bbf', '#a8894a']
const sinal = (n: number) => (n > 0 ? `+${n}` : `${n}`)

function tScore(levels: number[]): number {
  const k = levels.length
  if (k === 0) return 50
  const sum = levels.reduce((a, b) => a + b, 0)
  return Math.round(50 + (10 * sum) / Math.sqrt(0.7 * k + 0.3 * k * k))
}
function fmtData(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
// nível da meta numa data (carry-forward; antes do 1º andamento = partida)
function nivelEm(m: GasEscala, d: string): number {
  let lvl = m.nivelPartida
  for (const a of m.andamentos) { if (a.medidoEm <= d) lvl = a.nivel; else break }
  return lvl
}

type Ponto = { rotulo: string; t: number; respondidas: number; inicial: boolean; alerta: boolean; parcial: boolean }

export function GasProgressoCharts({ escalas }: { escalas: GasEscala[] }) {
  const metas = escalas
  const comDados = metas.filter(m => m.andamentos.length > 0)
  if (metas.length === 0 || comDados.length === 0) return null

  const k = metas.length
  const datas = Array.from(new Set(metas.flatMap(m => m.andamentos.map(a => a.medidoEm)))).sort()

  // Série do T-Score: ponto inicial (todas na partida) + cada data de avaliação.
  const base: Ponto = { rotulo: 'início', t: tScore(metas.map(m => m.nivelPartida)), respondidas: 0, inicial: true, alerta: false, parcial: false }
  const serie: Ponto[] = [base]
  let quedaPrev = false
  for (let i = 0; i < datas.length; i++) {
    const d = datas[i]
    const levels = metas.map(m => nivelEm(m, d))
    const t = tScore(levels)
    const respondidas = metas.filter(m => m.andamentos.some(a => a.medidoEm <= d)).length
    const anterior = serie[serie.length - 1].t
    const caiu = t < anterior
    const alerta = caiu && quedaPrev
    quedaPrev = caiu
    serie.push({ rotulo: fmtData(d), t, respondidas, inicial: false, alerta, parcial: respondidas < k })
  }

  return (
    <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
      <TScoreCard serie={serie} k={k} />
      <PorMetaCard metas={metas} datas={datas} />
    </div>
  )
}

// ─── Pontuação de Progresso (T-Score) ──────────────────────────────────
function TScoreCard({ serie, k }: { serie: Ponto[]; k: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const [explica, setExplica] = useState(false)

  const W = 640, H = 280, padL = 40, padR = 116, padT = 16, padB = 34
  const innerW = W - padL - padR, innerH = H - padT - padB
  const yFor = (v: number) => padT + ((80 - v) / 60) * innerH
  const n = serie.length
  const xFor = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const pts = serie.map((p, i) => ({ ...p, x: xFor(i), y: yFor(Math.max(20, Math.min(80, p.t))) }))
  const labelIdx = new Set([0, Math.floor((n - 1) / 2), n - 1])

  return (
    <div style={cardStyle}>
      <div style={headRow}>
        <span style={cardTitle}>Pontuação de Progresso <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(T-Score)</span></span>
        <button type="button" className="btn ghost" onClick={() => setExplica(true)} style={{ fontSize: 11.5, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>?</span>
          Entenda o T-Score
        </button>
      </div>

      <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Pontuação de progresso T-Score ao longo do tempo">
          {/* faixas */}
          <rect x={padL} y={yFor(80)} width={innerW} height={yFor(60) - yFor(80)} fill="rgba(90,158,138,.10)" />
          <rect x={padL} y={yFor(40)} width={innerW} height={yFor(20) - yFor(40)} fill="rgba(196,96,122,.08)" />
          {/* linhas de referência */}
          {[{ v: 60, c: 'var(--sage)', t: 'Acima do esperado' }, { v: 50, c: 'var(--ink-soft)', t: 'Resultado esperado' }, { v: 40, c: 'var(--rose)', t: 'Abaixo do esperado' }].map(r => (
            <g key={r.v}>
              <line x1={padL} y1={yFor(r.v)} x2={padL + innerW} y2={yFor(r.v)} stroke={r.c} strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
              <text x={padL + innerW + 6} y={yFor(r.v) + 3} fontSize="9.5" fill={r.c} opacity="0.85">{r.t}</text>
            </g>
          ))}
          {/* eixo Y */}
          {[20, 30, 40, 50, 60, 70, 80].map(v => (
            <text key={v} x={padL - 7} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--faint)">{v}</text>
          ))}
          {/* linha de progresso */}
          {n >= 2 && <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
          {/* marcadores */}
          {pts.map((p, i) => {
            const lit = hover === i
            if (p.inicial) return <path key={i} d={`M ${p.x} ${p.y - 5} L ${p.x + 5} ${p.y} L ${p.x} ${p.y + 5} L ${p.x - 5} ${p.y} Z`} fill="var(--accent)" stroke="var(--card)" strokeWidth="1.5" />
            if (p.alerta) return <g key={i}><circle cx={p.x} cy={p.y} r={6} fill="none" stroke="var(--rose)" strokeWidth="1.6" /><circle cx={p.x} cy={p.y} r={3} fill="var(--rose)" /></g>
            return <circle key={i} cx={p.x} cy={p.y} r={lit ? 5 : 4} fill={p.parcial ? 'var(--card)' : 'var(--accent)'} stroke="var(--accent)" strokeWidth={p.parcial ? 1.8 : 1.5} />
          })}
          {/* rótulos X */}
          {pts.map((p, i) => labelIdx.has(i) ? <text key={i} x={p.x} y={H - 12} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="9.5" fill="var(--muted)">{p.rotulo}</text> : null)}
          {/* hit-areas de hover (faixas verticais) */}
          {pts.map((p, i) => (
            <rect key={i} x={p.x - innerW / (2 * Math.max(1, n - 1))} y={padT} width={innerW / Math.max(1, n - 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
          ))}
          {hover != null && <line x1={pts[hover].x} y1={padT} x2={pts[hover].x} y2={padT + innerH} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />}
        </svg>

        {hover != null && <Tooltip p={pts[hover]} prev={hover > 0 ? pts[hover - 1].t : null} inicio={pts[0].t} k={k} left={(pts[hover].x / W) * 100} top={(pts[hover].y / H) * 100} />}
      </div>

      {/* legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
        <LegSwatch><path d="M 6 1 L 11 6 L 6 11 L 1 6 Z" fill="var(--accent)" /></LegSwatch><span>Avaliação inicial</span>
        <LegSwatch><circle cx="6" cy="6" r="4.5" fill="var(--accent)" /></LegSwatch><span>Avaliação</span>
        <LegSwatch><circle cx="6" cy="6" r="4.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.6" /></LegSwatch><span>Resposta parcial</span>
        <LegSwatch><g><circle cx="6" cy="6" r="5.2" fill="none" stroke="var(--rose)" strokeWidth="1.4" /><circle cx="6" cy="6" r="2.4" fill="var(--rose)" /></g></LegSwatch><span>Atenção: queda consecutiva</span>
      </div>

      {explica && <ExplicaTScore onClose={() => setExplica(false)} />}
    </div>
  )
}

function Tooltip({ p, prev, inicio, k, left, top }: { p: Ponto; prev: number | null; inicio: number; k: number; left: number; top: number }) {
  const dPrev = prev == null ? null : p.t - prev
  const dIni = p.t - inicio
  const seta = (v: number) => v > 0 ? '↑' : v < 0 ? '↓' : '·'
  const cor = (v: number) => v > 0 ? 'var(--sage)' : v < 0 ? 'var(--rose)' : 'var(--muted)'
  return (
    <div style={{
      position: 'absolute', left: `${left}%`, top: `${top}%`, transform: `translate(${left > 60 ? '-104%' : '12px'}, -50%)`,
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px',
      boxShadow: '0 12px 32px rgba(26,24,37,.16)', minWidth: 200, zIndex: 5, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{p.inicial ? 'Avaliação inicial' : p.rotulo}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Progresso geral: {p.t} pontos</div>
      {dPrev != null && <div style={{ fontSize: 12, color: cor(dPrev) }}>{seta(dPrev)} {dPrev > 0 ? '+' : ''}{dPrev} desde a avaliação anterior</div>}
      {!p.inicial && <div style={{ fontSize: 12, color: cor(dIni) }}>{seta(dIni)} {dIni > 0 ? '+' : ''}{dIni} desde o início</div>}
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
        Metas respondidas: {p.inicial ? 0 : p.respondidas} de {k}
      </div>
    </div>
  )
}

// ─── Evolução Longitudinal por Meta ────────────────────────────────────
function PorMetaCard({ metas, datas }: { metas: GasEscala[]; datas: string[] }) {
  const W = 640, H = 220, padL = 30, padR = 14, padT = 14, padB = 26
  const innerW = W - padL - padR, innerH = H - padT - padB
  const yFor = (v: number) => padT + ((2 - v) / 4) * innerH
  const cols = ['início', ...datas]
  const n = cols.length
  const xFor = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const labelIdx = new Set([0, Math.floor((n - 1) / 2), n - 1])

  return (
    <div style={cardStyle}>
      <div style={headRow}><span style={cardTitle}>Evolução Longitudinal por Meta</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Evolução por meta GAS">
        {[2, 1, 0, -1, -2].map(v => (
          <g key={v}>
            <line x1={padL} y1={yFor(v)} x2={padL + innerW} y2={yFor(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1 : 0.5} />
            <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--faint)">{sinal(v)}</text>
          </g>
        ))}
        {metas.map((m, mi) => {
          const cor = COLORS[mi % COLORS.length]
          const pts = cols.map((d, i) => ({ x: xFor(i), y: yFor(i === 0 ? m.nivelPartida : nivelEm(m, d)) }))
          return (
            <g key={m.id}>
              <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" opacity={m.ativo ? 1 : 0.4} />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 3 : 3.4} fill={i === 0 ? 'var(--card)' : cor} stroke={cor} strokeWidth="1.6" />)}
            </g>
          )
        })}
        {cols.map((d, i) => labelIdx.has(i) ? <text key={i} x={xFor(i)} y={H - 9} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="9.5" fill="var(--muted)">{i === 0 ? 'início' : fmtData(d)}</text> : null)}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 10 }}>
        {metas.map((m, mi) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: m.ativo ? 'var(--ink-soft)' : 'var(--muted)' }}>
            <span style={{ width: 18, height: 3, borderRadius: 2, background: COLORS[mi % COLORS.length], opacity: m.ativo ? 1 : 0.5 }} />
            <span style={{ fontWeight: 500 }}>{m.titulo}</span>
            <span style={{ color: 'var(--faint)' }}>· partida {sinal(m.nivelPartida)}{!m.ativo && ' · pausada'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Popover "Entenda o T-Score" ───────────────────────────────────────
function ExplicaTScore({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,38,.45)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(3px)' }}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>O que é o T-Score</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Fechar" style={{ padding: '2px 9px' }}>✕</button>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 12px' }}>
          O T-Score resume <strong>todas as metas GAS deste objetivo</strong> num único número, pra você ver o progresso geral de relance.
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          <li><strong>50</strong> = exatamente o esperado (todas as metas no nível 0).</li>
          <li><strong>≥ 60</strong> = acima do esperado.</li>
          <li><strong>≤ 40</strong> = abaixo do esperado — vale revisar.</li>
        </ul>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          É o método padrão da literatura (Kiresuk &amp; Sherman): combina os níveis −2…+2 de cada meta numa escala comparável ao longo do tempo. Não é diagnóstico — é um indicador de acompanhamento.
        </p>
      </div>
    </div>
  )
}

// ─── estilos compartilhados ────────────────────────────────────────────
const cardStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--card)' }
const headRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }
const cardTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }
function LegSwatch({ children }: { children: React.ReactNode }) {
  return <svg width="12" height="12" viewBox="0 0 12 12" style={{ flex: 'none' }}>{children}</svg>
}
