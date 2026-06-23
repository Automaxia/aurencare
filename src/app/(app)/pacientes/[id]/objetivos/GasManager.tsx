'use client'

import { useState } from 'react'
import type { GasEscala, GasAndamento } from '@/server/services/gasObjetivos'
import { criarGasAction, atualizarGasAction, removerGasAction, registrarAndamentoGasAction } from './actions'

/**
 * Escalas GAS — ferramenta de acompanhamento da Meta. Após preencher os níveis,
 * a escala NÃO é editável: só pausar/reativar ou excluir. O psicólogo registra os
 * andamentos (nível atual −2..+2) ao longo do tempo.
 */

const NIVEIS = [
  { campo: 'nivelP2', v: 2,  rotulo: '+2 · muito acima do esperado' },
  { campo: 'nivelP1', v: 1,  rotulo: '+1 · acima do esperado' },
  { campo: 'nivel0',  v: 0,  rotulo: '0 · nível esperado' },
  { campo: 'nivelM1', v: -1, rotulo: '−1 · abaixo do esperado' },
  { campo: 'nivelM2', v: -2, rotulo: '−2 · muito abaixo do esperado' },
] as const

const sinal = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const descNivel = (e: GasEscala, v: number): string | null =>
  ({ 2: e.nivelP2, 1: e.nivelP1, 0: e.nivel0, [-1]: e.nivelM1, [-2]: e.nivelM2 } as Record<number, string | null>)[v]

export function GasManager({ objetivoId, escalas, onChange }: {
  objetivoId: string
  escalas: GasEscala[]
  onChange: (escalas: GasEscala[]) => void
}) {
  const [criando, setCriando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function replace(id: string, esc: GasEscala) { onChange(escalas.map(e => e.id === id ? esc : e)) }

  async function criar(payload: Parameters<typeof criarGasAction>[1]) {
    setSalvando(true)
    const r = await criarGasAction(objetivoId, payload)
    setSalvando(false)
    if (!r) return
    onChange([...escalas, r]); setCriando(false)
  }
  async function togglePausa(e: GasEscala) {
    const r = await atualizarGasAction(objetivoId, e.id, { ativo: !e.ativo })
    if (r) replace(e.id, { ...r, andamentos: e.andamentos })
  }
  async function remover(e: GasEscala) {
    if (!confirm(`Excluir a escala GAS "${e.titulo}"? Os andamentos registrados também serão removidos.`)) return
    await removerGasAction(objetivoId, e.id)
    onChange(escalas.filter(x => x.id !== e.id))
  }
  async function registrar(e: GasEscala, nivel: number, data: string) {
    const a = await registrarAndamentoGasAction(objetivoId, e.id, nivel, data)
    if (a) replace(e.id, { ...e, andamentos: [...e.andamentos, a].sort((x, y) => x.medidoEm.localeCompare(y.medidoEm)) })
  }

  return (
    <div style={{
      marginTop: 16, padding: 16, borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(106,78,200,.07), rgba(90,158,138,.05))',
      border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--accent)' }}>◬</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Escalas GAS · acompanhamento da meta</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Registre o nível alcançado ao longo do tempo. Você pode ter mais de uma escala.</div>
          </div>
        </div>
        {!criando && (
          <button type="button" className="btn primary" onClick={() => setCriando(true)} style={{ fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}>
            + Escala GAS
          </button>
        )}
      </div>

      {escalas.length === 0 && !criando && (
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Nenhuma escala ainda. Descreva os 5 níveis para acompanhar metas subjetivas (culpa, autoestima, relação com alguém).
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {escalas.map(e => (
          <GasCard key={e.id} escala={e} onPausa={() => togglePausa(e)} onRemover={() => remover(e)} onRegistrar={(n, d) => registrar(e, n, d)} />
        ))}
        {criando && <GasForm salvando={salvando} onSalvar={criar} onCancelar={() => setCriando(false)} />}
      </div>
    </div>
  )
}

function GasCard({ escala, onPausa, onRemover, onRegistrar }: {
  escala: GasEscala
  onPausa: () => void
  onRemover: () => void
  onRegistrar: (nivel: number, data: string) => void
}) {
  const atual = escala.andamentos.length ? escala.andamentos[escala.andamentos.length - 1].nivel : null
  const [nivel, setNivel] = useState<number>(atual ?? escala.nivelPartida)
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [registrando, setRegistrando] = useState(false)

  async function reg() {
    setRegistrando(true)
    await onRegistrar(nivel, data)
    setRegistrando(false)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--card)', opacity: escala.ativo ? 1 : 0.7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{escala.titulo}</span>
          {!escala.ativo && <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>· pausada</span>}
          {atual != null && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>atual {sinal(atual)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost" onClick={onPausa} style={{ fontSize: 11, padding: '3px 9px' }}>{escala.ativo ? 'Pausar' : 'Reativar'}</button>
          <button className="btn ghost" onClick={onRemover} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--rose)' }}>✕</button>
        </div>
      </div>

      {/* Níveis (somente leitura) com partida/esperado/atual */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {NIVEIS.map(n => {
          const ehAtual = atual === n.v
          return (
            <li key={n.v} style={{
              display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 12.5, lineHeight: 1.4,
              padding: '3px 7px', borderRadius: 6,
              background: ehAtual ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
            }}>
              <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: n.v === 0 ? 'var(--accent)' : 'var(--ink-soft)', minWidth: 22 }}>{sinal(n.v)}</span>
              <span style={{ flex: 1, color: descNivel(escala, n.v) ? 'var(--ink-soft)' : 'var(--faint)' }}>
                {descNivel(escala, n.v) || '—'}
                {escala.nivelPartida === n.v && <span style={chip('var(--amber)')}>partida</span>}
                {escala.nivelEsperado === n.v && <span style={chip('var(--sage)')}>esperado</span>}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Registrar andamento */}
      {escala.ativo && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Nível alcançado</span>
            <select value={nivel} onChange={e => setNivel(Number(e.target.value))} style={{ ...inp, minWidth: 220 }}>
              {NIVEIS.map(n => <option key={n.v} value={n.v}>{sinal(n.v)} · {descNivel(escala, n.v) || n.rotulo}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Data</span>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ ...inp, width: 150 }} />
          </label>
          <button type="button" className="btn primary" onClick={reg} disabled={registrando} style={{ height: 36, fontSize: 12.5 }}>
            {registrando ? '…' : '+ Registrar andamento'}
          </button>
        </div>
      )}

      {/* Histórico de andamentos — gráfico + chips */}
      {escala.andamentos.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            Evolução do andamento
          </div>
          <GasChart andamentos={escala.andamentos} partida={escala.nivelPartida} esperado={escala.nivelEsperado} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            {escala.andamentos.map((a, i) => (
              <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--surface)', color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                {formatData(a.medidoEm)} <strong style={{ color: a.nivel >= escala.nivelEsperado ? 'var(--sage)' : 'var(--ink)' }}>{sinal(a.nivel)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GasForm({ salvando, onSalvar, onCancelar }: {
  salvando: boolean
  onSalvar: (p: { titulo: string; nivelM2: string | null; nivelM1: string | null; nivel0: string | null; nivelP1: string | null; nivelP2: string | null; nivelPartida: number; nivelEsperado: number }) => void
  onCancelar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [nv, setNv] = useState<Record<string, string>>({ nivelP2: '', nivelP1: '', nivel0: '', nivelM1: '', nivelM2: '' })
  const [partida, setPartida] = useState(-1)
  const [esperado, setEsperado] = useState(2)
  const [erro, setErro] = useState<string | null>(null)

  function submit() {
    if (titulo.trim().length < 2) { setErro('Dê um nome à escala (ex: "Relação com o chefe").'); return }
    setErro(null)
    onSalvar({
      titulo: titulo.trim(),
      nivelM2: nv.nivelM2.trim() || null, nivelM1: nv.nivelM1.trim() || null, nivel0: nv.nivel0.trim() || null,
      nivelP1: nv.nivelP1.trim() || null, nivelP2: nv.nivelP2.trim() || null,
      nivelPartida: partida, nivelEsperado: esperado,
    })
  }

  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 10, padding: 14, display: 'grid', gap: 12, background: 'var(--card)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Depois de criar, os níveis não podem ser editados — só pausar ou excluir. Revise antes de salvar.</div>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nome da escala GAS</span>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Relação com o chefe" style={inp} />
      </label>

      <div style={{ display: 'grid', gap: 7 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Descreva cada nível (do melhor ao pior)</span>
        {NIVEIS.map(n => (
          <div key={n.v} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, alignItems: 'start' }}>
            <span style={{ fontSize: 11.5, color: n.v === 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, paddingTop: 9, fontVariantNumeric: 'tabular-nums' }}>{sinal(n.v)}</span>
            <textarea value={nv[n.campo]} onChange={e => setNv(s => ({ ...s, [n.campo]: e.target.value }))} rows={1} placeholder={n.rotulo} style={{ ...inp, resize: 'vertical', minHeight: 34 }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nível de partida</span>
          <select value={partida} onChange={e => setPartida(Number(e.target.value))} style={inp}>
            {[2, 1, 0, -1, -2].map(v => <option key={v} value={v}>{sinal(v)}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nível esperado (meta)</span>
          <select value={esperado} onChange={e => setEsperado(Number(e.target.value))} style={inp}>
            {[2, 1, 0, -1, -2].map(v => <option key={v} value={v}>{sinal(v)}</option>)}
          </select>
        </label>
      </div>

      {erro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn primary" onClick={submit} disabled={salvando}>{salvando ? 'Salvando…' : '+ Criar escala'}</button>
      </div>
    </div>
  )
}

/** Gráfico do andamento GAS — domínio fixo −2..+2, com linhas de referência de
 *  partida (âmbar) e esperado (sage). Mostra a partir de 1 ponto. */
function GasChart({ andamentos, partida, esperado }: { andamentos: GasAndamento[]; partida: number; esperado: number }) {
  const W = 320, H = 120, padL = 26, padR = 10, padT = 10, padB = 18
  const innerW = W - padL - padR, innerH = H - padT - padB
  const n = andamentos.length
  const yFor = (v: number) => padT + ((2 - v) / 4) * innerH
  const xFor = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const pontos = andamentos.map((a, i) => ({ x: xFor(i), y: yFor(a.nivel), a }))
  const ultimo = andamentos[n - 1].nivel

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Gráfico de andamento GAS">
      {/* grade horizontal nos níveis */}
      {[2, 1, 0, -1, -2].map(v => (
        <g key={v}>
          <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1 : 0.5} />
          <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {/* referências partida / esperado */}
      <line x1={padL} y1={yFor(esperado)} x2={W - padR} y2={yFor(esperado)} stroke="var(--sage)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
      <line x1={padL} y1={yFor(partida)} x2={W - padR} y2={yFor(partida)} stroke="var(--amber)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
      {/* linha do andamento */}
      {n >= 2 && (
        <polyline points={pontos.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {/* pontos */}
      {pontos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4 : 3} fill={ultimo >= esperado && i === n - 1 ? 'var(--sage)' : 'var(--accent)'} stroke="var(--card)" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function chip(cor: string): React.CSSProperties {
  return { marginLeft: 7, fontSize: 10, padding: '1px 6px', borderRadius: 999, background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor, fontWeight: 600, whiteSpace: 'nowrap' }
}
function formatData(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}
