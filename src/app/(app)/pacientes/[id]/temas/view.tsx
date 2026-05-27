'use client'

import { useEffect, useState } from 'react'
import type { GrafoDados, GrafoNode } from '@/server/services/temas'
import { GrafoCanvas } from './GrafoCanvas'
import { TemasChat } from './TemasChat'
import { CfpBadge } from '@/components/brand/CfpBadge'

export function TemasView({ pacienteId, initialGrafo }: { pacienteId: string; initialGrafo: GrafoDados }) {
  const [grafo, setGrafo] = useState(initialGrafo)
  const [selecionado, setSelecionado] = useState<GrafoNode | null>(null)
  const [recalc, setRecalc] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

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
      setInsight(null)
      fetchInsight()
    } finally {
      setRecalc(false)
    }
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, gap: 12 }}>
        <InsightCard text={insight} loading={insightLoading} />
        <button className="btn ghost" onClick={recalcular} disabled={recalc}>
          {recalc ? 'Recalculando…' : '↻ Recalcular'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <div className="graph-stage">
          <GrafoCanvas grafo={grafo} onSelect={setSelecionado} selecionado={selecionado} />
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12 }}>
          {selecionado ? <NodeDetail node={selecionado} grafo={grafo} /> : <NodeLegend />}
          <TemasChat pacienteId={pacienteId} selecionado={selecionado?.palavra ?? null} />
        </div>
      </div>
    </div>
  )
}

function InsightCard({ text, loading }: { text: string | null; loading: boolean }) {
  return (
    <div className="card" style={{ flex: 1, padding: '12px 16px', background: 'var(--accent-lo)', borderColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#4a3299', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>
          Observação inicial
        </span>
        <CfpBadge />
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>… gerando observação</div>
      ) : text ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>{text}</p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sem dados suficientes para uma observação.</p>
      )}
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
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Tema</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
        <h3 style={{ margin: 0 }}>{node.palavra}</h3>
        <span style={{ fontSize: 11, color: CLUSTER_COLORS[node.cluster] }}>{node.cluster}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        Frequência total: {node.frequencia}
      </div>
      {conexoes.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, marginBottom: 4 }}>Co-ocorre com</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
            {conexoes.map(c => (
              <li key={c.outra} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{c.outra}</span>
                <span style={{ color: 'var(--muted)' }}>×{c.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function NodeLegend() {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Clusters</div>
      {(Object.entries(CLUSTER_COLORS) as [string, string][]).map(([k, c]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c }} />
          {k}
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>Clique em um nó para ver detalhes.</p>
    </div>
  )
}

export const CLUSTER_COLORS: Record<string, string> = {
  emocional:   '#6a4ec8',
  relacional:  '#c4607a',
  situacional: '#5a9e8a',
  cognitivo:   '#b07d40',
}
