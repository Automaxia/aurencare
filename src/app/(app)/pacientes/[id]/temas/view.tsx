'use client'

import { useEffect, useState } from 'react'
import type { GrafoDados, GrafoNode } from '@/server/services/temas'
import { GrafoCanvas } from './GrafoCanvas'
import { TemasChat } from './TemasChat'
import { CfpBadge } from '@/components/brand/CfpBadge'

export const CLUSTER_COLORS: Record<string, string> = {
  emocional:   '#6a4ec8',
  relacional:  '#c4607a',
  situacional: '#5a9e8a',
  cognitivo:   '#b07d40',
}

const CLUSTERS: { key: string; label: string }[] = [
  { key: 'all',         label: 'Todos' },
  { key: 'emocional',   label: 'Emocional' },
  { key: 'relacional',  label: 'Relacional' },
  { key: 'situacional', label: 'Situacional' },
  { key: 'cognitivo',   label: 'Cognitivo' },
]

type Props = {
  pacienteId: string
  pacienteNome: string
  initialGrafo: GrafoDados
}

export function TemasView({ pacienteId, pacienteNome, initialGrafo }: Props) {
  const [grafo, setGrafo] = useState(initialGrafo)
  const [selecionado, setSelecionado] = useState<GrafoNode | null>(null)
  const [recalc, setRecalc] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [activeCluster, setActiveCluster] = useState('all')

  async function fetchInsight() {
    if (grafo.nodes.length === 0) return
    setInsightLoading(true)
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/temas/insight`)
      const json = await res.json()
      setInsight(json?.text ?? null)
    } finally {
      setInsightLoading(false)
    }
  }
  useEffect(() => { fetchInsight() }, [pacienteId])

  async function recalcular() {
    setRecalc(true)
    try {
      await fetch(`/api/pacientes/${pacienteId}/temas/recalcular`, { method: 'POST' })
      const res = await fetch(`/api/pacientes/${pacienteId}/temas`)
      const json = await res.json()
      setGrafo(json)
      setInsight(null); fetchInsight()
    } finally {
      setRecalc(false)
    }
  }

  // Filtra localmente por cluster
  const filteredGrafo: GrafoDados = activeCluster === 'all' ? grafo : {
    nodes: grafo.nodes.filter(n => n.cluster === activeCluster),
    edges: grafo.edges.filter(e => {
      const a = grafo.nodes.find(n => n.palavra === e.a)
      const b = grafo.nodes.find(n => n.palavra === e.b)
      return a?.cluster === activeCluster && b?.cluster === activeCluster
    }),
  }

  if (grafo.nodes.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
          Sem temas extraídos ainda. Assine algumas sessões — os temas aparecem aqui depois.
        </p>
        <button className="btn" onClick={recalcular} disabled={recalc}>
          {recalc ? 'Calculando…' : 'Recalcular a partir das sessões assinadas'}
        </button>
      </div>
    )
  }

  // Top correlações pra coluna central
  const topCorr = [...grafo.edges].sort((a, b) => b.weight - a.weight).slice(0, 6)

  // Distribuição por cluster
  const clusterCounts: Record<string, number> = { emocional: 0, relacional: 0, situacional: 0, cognitivo: 0 }
  for (const n of grafo.nodes) clusterCounts[n.cluster] = (clusterCounts[n.cluster] ?? 0) + 1

  return (
    <div>
      {/* Auto-insight banner */}
      <InsightCard text={insight} loading={insightLoading} />

      {/* Filtros + recalcular */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 14px' }}>
        <div className="ftabs">
          {CLUSTERS.map(c => (
            <button
              key={c.key}
              type="button"
              className={`ftab${activeCluster === c.key ? ' active' : ''}`}
              onClick={() => setActiveCluster(c.key)}
            >
              {c.key !== 'all' && (
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: CLUSTER_COLORS[c.key], marginRight: 5, verticalAlign: 'middle',
                }} />
              )}
              {c.label}
              {c.key !== 'all' && clusterCounts[c.key] > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>{clusterCounts[c.key]}</span>
              )}
            </button>
          ))}
        </div>
        <button className="btn ghost sm" onClick={recalcular} disabled={recalc} title="Recalcular grafo">
          {recalc ? 'Recalculando…' : '↻ Recalcular'}
        </button>
      </div>

      <div className="grafo-wrap">
        {/* Canvas com legend interna */}
        <div className="graph-container">
          <div className="graph-legend">
            <div className="gl-title">Temas</div>
            {(Object.entries(CLUSTER_COLORS) as [string, string][]).map(([k, c]) => (
              <div key={k} className="gl-row">
                <div className="gl-dot" style={{ background: c }} />
                <span className="gl-lbl">{capitalize(k)}</span>
              </div>
            ))}
          </div>
          <div className="graph-hint">Clique em um tema para explorar</div>
          <GrafoCanvas grafo={filteredGrafo} onSelect={setSelecionado} selecionado={selecionado} />
        </div>

        {/* Coluna do meio: NodeDetail/Placeholder + Temas mais presentes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selecionado ? <NodeDetail node={selecionado} grafo={grafo} /> : <NodePlaceholder />}

          <div className="card" style={{ padding: 0 }}>
            <div className="card-h" style={{ padding: '12px 16px' }}>
              <span className="card-title">Temas mais presentes</span>
            </div>
            <div style={{ padding: '10px 16px' }}>
              {grafo.nodes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem temas.</div>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
                  {grafo.nodes.slice(0, 6).map((n, i) => (
                    <li key={i}
                        onClick={() => setSelecionado(n)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: CLUSTER_COLORS[n.cluster] }} />
                        {n.palavra}
                      </span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{n.frequencia}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {topCorr.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-h" style={{ padding: '12px 16px' }}>
                <span className="card-title">Co-ocorrências mais frequentes</span>
              </div>
              <div style={{ padding: '10px 16px' }}>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
                  {topCorr.map((c, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)' }}>
                      <span>{c.a} <span style={{ color: 'var(--faint)' }}>+</span> {c.b}</span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>×{c.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Chat IA dark */}
        <div className="ai-chat-col" style={{ position: 'sticky', top: 70, alignSelf: 'start' }}>
          <TemasChat pacienteId={pacienteId} pacienteNome={pacienteNome} selecionado={selecionado?.palavra ?? null} />
        </div>
      </div>
    </div>
  )
}

function InsightCard({ text, loading }: { text: string | null; loading: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 18px', background: 'var(--accent-lo)', borderColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#4a3299', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 500 }}>
          Observação inicial
        </span>
        <CfpBadge />
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>… gerando observação</div>
      ) : text ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>{text}</p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sem dados suficientes para uma observação.</p>
      )}
    </div>
  )
}

function NodePlaceholder() {
  return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 22, marginBottom: 10, opacity: .4 }}>◍</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 5 }}>Clique em um tema</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Veja como os temas das sessões se conectam ao longo do tempo.
      </div>
    </div>
  )
}

function NodeDetail({ node, grafo }: { node: GrafoNode; grafo: GrafoDados }) {
  const conexoes = grafo.edges
    .filter(e => e.a === node.palavra || e.b === node.palavra)
    .map(e => ({ outra: e.a === node.palavra ? e.b : e.a, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: CLUSTER_COLORS[node.cluster] }} />
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--f-display)', fontWeight: 400, color: 'var(--ink-soft)' }}>{node.palavra}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{capitalize(node.cluster)} · {node.frequencia}× nas sessões</div>
        </div>
      </div>
      {conexoes.length > 0 && (
        <>
          <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
            Conexões com outros temas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conexoes.map(c => (
              <div key={c.outra} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)' }}>
                <span>{c.outra}</span>
                <span style={{ color: 'var(--muted)' }}>×{c.weight}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
