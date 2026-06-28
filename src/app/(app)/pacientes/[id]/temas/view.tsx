'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { RotateCw } from 'lucide-react'
import type { GrafoDados, GrafoNode, PadroesLongitudinais } from '@/server/services/temas'
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

type SessaoOpt = { id: string; numero: number; dataHora: string; assinada: boolean }

type Props = {
  pacienteId: string
  pacienteNome: string
  initialGrafo: GrafoDados
  padroes: PadroesLongitudinais
  sessoes: SessaoOpt[]
}

const LIMIAR_CLINICO = 0.5

export function TemasView({ pacienteId, pacienteNome, initialGrafo, padroes, sessoes }: Props) {
  const [grafo, setGrafo] = useState(initialGrafo)
  const [selecionado, setSelecionado] = useState<GrafoNode | null>(null)
  const [recalc, setRecalc] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [activeCluster, setActiveCluster] = useState('all')
  const [filterSessao, setFilterSessao] = useState<string>('all')
  // §4: o store é permissivo; a TELA filtra. Clínico = só relevância alta; Tudo = tudo.
  const [vista, setVista] = useState<'clinico' | 'tudo'>('clinico')
  const [ocultarIsolados, setOcultarIsolados] = useState(false)
  const [recalcErro, setRecalcErro] = useState<string | null>(null)

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
    setRecalc(true); setRecalcErro(null)
    try {
      const post = await fetch(`/api/pacientes/${pacienteId}/temas/recalcular`, { method: 'POST' })
      if (!post.ok) { setRecalcErro('Não foi possível recalcular agora. Se o paciente tiver muitas sessões pode levar um momento — recarregue a página em instantes.'); return }
      const r = await post.json().catch(() => ({}))
      if (r?.abortado) { setRecalcErro('A IA está indisponível no momento — o grafo foi preservado. Tente novamente mais tarde.'); return }
      const res = await fetch(`/api/pacientes/${pacienteId}/temas`)
      const json = await res.json()
      setGrafo(json)
      setInsight(null); fetchInsight()
    } catch {
      setRecalcErro('Falha de conexão durante o recálculo. O processamento pode seguir no servidor — recarregue a página em instantes.')
    } finally {
      setRecalc(false)
    }
  }

  // Filtra localmente por cluster + sessão + relevância (vista) + isolados.
  let fNodes = grafo.nodes.filter(n => {
    if (activeCluster !== 'all' && n.cluster !== activeCluster) return false
    if (filterSessao !== 'all' && !(n.sessoesIds ?? []).includes(filterSessao)) return false
    if (vista === 'clinico' && n.relevancia != null && n.relevancia < LIMIAR_CLINICO) return false
    return true
  })
  let fSet = new Set(fNodes.map(n => n.palavra))
  let fEdges = grafo.edges.filter(e => fSet.has(e.a) && fSet.has(e.b))
  if (ocultarIsolados) {
    const conectados = new Set<string>()
    for (const e of fEdges) { conectados.add(e.a); conectados.add(e.b) }
    fNodes = fNodes.filter(n => conectados.has(n.palavra))
    fSet = new Set(fNodes.map(n => n.palavra))
    fEdges = fEdges.filter(e => fSet.has(e.a) && fSet.has(e.b))
  }
  const filteredGrafo: GrafoDados = { nodes: fNodes, edges: fEdges }

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

      {/* §3/§7.4 — padrões que recorrem ao longo das sessões (contado do store) */}
      <PadroesPanel padroes={padroes} />

      {/* Filtros + select de sessão + recalcular */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 14px', gap: 12, flexWrap: 'wrap' }}>
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

        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ftabs" title="Clínico mostra só os construtos mais relevantes; Tudo mostra o que o store guardou (sinais fracos inclusive).">
            <button type="button" className={`ftab${vista === 'clinico' ? ' active' : ''}`} onClick={() => setVista('clinico')}>Clínico</button>
            <button type="button" className={`ftab${vista === 'tudo' ? ' active' : ''}`} onClick={() => setVista('tudo')}>Tudo</button>
          </div>
          <button
            type="button"
            className={`ftab${ocultarIsolados ? ' active' : ''}`}
            onClick={() => setOcultarIsolados(v => !v)}
            title="Esconde nós que não se conectam a nenhum outro"
            style={{ borderRadius: 9 }}
          >
            Só conectados
          </button>
          <select
            value={filterSessao}
            onChange={e => setFilterSessao(e.target.value)}
            style={{
              border: '1px solid var(--border-md)', borderRadius: 9,
              padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
              background: 'var(--card)', color: 'var(--ink-soft)',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">Todas as sessões</option>
            {sessoes.map(s => (
              <option key={s.id} value={s.id}>
                Sessão {s.numero} · {new Date(s.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </option>
            ))}
          </select>
          <button
            className="btn" onClick={recalcular} disabled={recalc}
            title="Recalcular o grafo a partir das sessões assinadas"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500,
              color: 'var(--accent)', border: '1px solid var(--accent)', background: 'var(--accent-lo)',
              boxShadow: '0 1px 3px rgba(106,78,200,.18)',
            }}
          >
            <RotateCw size={13} /> {recalc ? 'Recalculando…' : 'Recalcular'}
          </button>
        </div>
      </div>

      {recalcErro && (
        <div style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 10, background: 'var(--rose-lo)', color: 'var(--rose)', fontSize: 12.5, lineHeight: 1.5 }}>
          {recalcErro}
        </div>
      )}

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

const rotuloStyle = { fontSize: 9.5, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--faint)', marginBottom: 8 }

function PadroesPanel({ padroes }: { padroes: PadroesLongitudinais }) {
  const N = padroes.totalSessoes
  const arestasRec = padroes.arestas.filter(a => a.nSessoes >= 2).slice(0, 6)
  const nosRec = padroes.nos.filter(n => n.nSessoes >= 2).slice(0, 8)
  if (arestasRec.length === 0 && nosRec.length === 0) return null
  const linha: CSSProperties = { fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }
  const cont = (n: number) => <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>em {n} de {N} sessões</span>
  return (
    <div className="card" style={{ padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 13.5, fontFamily: 'var(--f-display)', color: 'var(--ink-soft)', marginBottom: 2 }}>Padrões ao longo do tempo</div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 12 }}>Recorrência contada das sessões — hipóteses a investigar, não conclusões.</div>
      {arestasRec.length > 0 && (
        <div style={{ marginBottom: nosRec.length ? 14 : 0 }}>
          <div style={rotuloStyle}>Relações que recorrem</div>
          <div style={{ display: 'grid', gap: 2 }}>
            {arestasRec.map((a, i) => (
              <div key={i} style={linha}>
                <span>{a.a} <span style={{ color: 'var(--faint)' }}>{a.relacao ? `—${a.relacao}→` : '—'}</span> {a.b}</span>
                {cont(a.nSessoes)}
              </div>
            ))}
          </div>
        </div>
      )}
      {nosRec.length > 0 && (
        <div>
          <div style={rotuloStyle}>Núcleos recorrentes</div>
          <div style={{ display: 'grid', gap: 2 }}>
            {nosRec.map((n, i) => (
              <div key={i} style={linha}>
                <span>{n.nucleo}{n.reaparece && <span style={{ color: 'var(--amber)', fontSize: 11 }}> · some e reaparece</span>}</span>
                {cont(n.nSessoes)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NodeDetail({ node, grafo }: { node: GrafoNode; grafo: GrafoDados }) {
  const conexoes = grafo.edges
    .filter(e => e.a === node.palavra || e.b === node.palavra)
    .map(e => ({ outra: e.a === node.palavra ? e.b : e.a, weight: e.weight, tipo: e.tipo ?? null }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
  const nSess = node.frequencia
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: CLUSTER_COLORS[node.cluster] }} />
        <div>
          <div style={{ fontSize: 17, fontFamily: 'var(--f-display)', fontWeight: 400, color: 'var(--ink-soft)' }}>{node.palavra}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {capitalize(node.cluster)} · {nSess === 1 ? 'em 1 sessão' : `em ${nSess} sessões`}
            {node.relevancia != null && ` · relevância ${Math.round(node.relevancia * 100)}%`}
          </div>
        </div>
      </div>

      {node.construto && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 14px' }}>{node.construto}</p>
      )}

      {node.contextos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={rotuloStyle}>Onde aparece</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {node.contextos.map((c, i) => (
              <span key={i} style={{ fontSize: 11.5, color: 'var(--ink-soft)', background: 'var(--surface)', borderRadius: 999, padding: '3px 10px' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {conexoes.length > 0 && (
        <>
          <div style={rotuloStyle}>Conexões com outros temas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conexoes.map(c => (
              <div key={c.outra} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
                <span>{c.outra}{c.tipo && <span style={{ color: 'var(--faint)' }}> · {c.tipo}</span>}</span>
                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.weight === 1 ? '1 sessão' : `${c.weight} sessões`}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {node.foraConceitualizacao && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--amber)' }}>⚠ fora da conceitualização atual</div>
      )}
    </div>
  )
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
