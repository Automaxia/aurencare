'use client'

import { useState } from 'react'
import type { GasEscala } from '@/server/services/gasObjetivos'
import { criarGasAction, atualizarGasAction, removerGasAction } from './actions'

/**
 * Configuração das escalas GAS de uma Meta. GAS é a ferramenta de acompanhamento:
 * opcional, editável e múltipla por Meta. 5 níveis padrão (−2..+2) descritos pelo
 * psicólogo, com marcação de partida e esperado.
 */

const NIVEIS = [
  { campo: 'nivelP2', v: 2,  rotulo: '+2 · muito acima do esperado' },
  { campo: 'nivelP1', v: 1,  rotulo: '+1 · acima do esperado' },
  { campo: 'nivel0',  v: 0,  rotulo: '0 · nível esperado (meta)' },
  { campo: 'nivelM1', v: -1, rotulo: '−1 · abaixo do esperado' },
  { campo: 'nivelM2', v: -2, rotulo: '−2 · muito abaixo do esperado' },
] as const

const sinal = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function GasManager({ objetivoId, escalas, onChange }: {
  objetivoId: string
  escalas: GasEscala[]
  onChange: (escalas: GasEscala[]) => void
}) {
  const [editando, setEditando] = useState<string | 'novo' | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(payload: Parameters<typeof criarGasAction>[1], id?: string) {
    setSalvando(true)
    const r = id
      ? await atualizarGasAction(objetivoId, id, payload)
      : await criarGasAction(objetivoId, payload)
    setSalvando(false)
    if (!r) return
    onChange(id ? escalas.map(e => e.id === id ? r : e) : [...escalas, r])
    setEditando(null)
  }

  async function remover(id: string) {
    if (!confirm('Remover esta escala GAS?')) return
    await removerGasAction(objetivoId, id)
    onChange(escalas.filter(e => e.id !== id))
    if (editando === id) setEditando(null)
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Escalas GAS · acompanhamento da meta
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
            Opcional. Você pode ter mais de uma escala por meta.
          </div>
        </div>
        {editando === null && (
          <button type="button" className="btn ghost" onClick={() => setEditando('novo')} style={{ fontSize: 12 }}>
            + Escala GAS
          </button>
        )}
      </div>

      {escalas.length === 0 && editando !== 'novo' && (
        <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
          Nenhuma escala GAS ainda. Descreva os 5 níveis para acompanhar metas subjetivas (culpa, autoestima, relação com alguém).
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {escalas.map(e => (
          editando === e.id
            ? <GasForm key={e.id} inicial={e} salvando={salvando} onSalvar={p => salvar(p, e.id)} onCancelar={() => setEditando(null)} />
            : <GasCard key={e.id} escala={e} onEditar={() => setEditando(e.id)} onRemover={() => remover(e.id)} />
        ))}
        {editando === 'novo' && (
          <GasForm salvando={salvando} onSalvar={p => salvar(p)} onCancelar={() => setEditando(null)} />
        )}
      </div>
    </div>
  )
}

function GasCard({ escala, onEditar, onRemover }: { escala: GasEscala; onEditar: () => void; onRemover: () => void }) {
  const desc: Record<number, string | null> = {
    2: escala.nivelP2, 1: escala.nivelP1, 0: escala.nivel0, [-1]: escala.nivelM1, [-2]: escala.nivelM2,
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{escala.titulo}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost" onClick={onEditar} style={{ fontSize: 11, padding: '3px 8px' }}>Editar</button>
          <button className="btn ghost" onClick={onRemover} style={{ fontSize: 11, padding: '3px 8px', color: 'var(--rose)' }}>×</button>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 5 }}>
        {NIVEIS.map(n => {
          const ehPartida = escala.nivelPartida === n.v
          const ehEsperado = escala.nivelEsperado === n.v
          return (
            <li key={n.v} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 12.5, lineHeight: 1.45 }}>
              <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: n.v === 0 ? 'var(--accent)' : 'var(--muted)', minWidth: 22 }}>{sinal(n.v)}</span>
              <span style={{ flex: 1, color: desc[n.v] ? 'var(--ink-soft)' : 'var(--faint)' }}>
                {desc[n.v] || '—'}
                {ehPartida && <span style={chip('var(--amber)')}>partida</span>}
                {ehEsperado && <span style={chip('var(--sage)')}>esperado</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function chip(cor: string): React.CSSProperties {
  return { marginLeft: 7, fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, ' + cor + ' 14%, transparent)', color: cor, fontWeight: 600, whiteSpace: 'nowrap' }
}

function GasForm({ inicial, salvando, onSalvar, onCancelar }: {
  inicial?: GasEscala
  salvando: boolean
  onSalvar: (p: { titulo: string; nivelM2: string | null; nivelM1: string | null; nivel0: string | null; nivelP1: string | null; nivelP2: string | null; nivelPartida: number; nivelEsperado: number }) => void
  onCancelar: () => void
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [nv, setNv] = useState<Record<string, string>>({
    nivelP2: inicial?.nivelP2 ?? '', nivelP1: inicial?.nivelP1 ?? '', nivel0: inicial?.nivel0 ?? '',
    nivelM1: inicial?.nivelM1 ?? '', nivelM2: inicial?.nivelM2 ?? '',
  })
  const [partida, setPartida] = useState(inicial?.nivelPartida ?? -1)
  const [esperado, setEsperado] = useState(inicial?.nivelEsperado ?? 0)
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
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nome da escala GAS</span>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Relação com o chefe" style={inp} />
      </label>

      <div style={{ display: 'grid', gap: 7 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Descreva cada nível (do melhor ao pior)</span>
        {NIVEIS.map(n => (
          <div key={n.v} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, alignItems: 'start' }}>
            <span style={{ fontSize: 11.5, color: n.v === 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, paddingTop: 9, fontVariantNumeric: 'tabular-nums' }}>{sinal(n.v)}</span>
            <textarea value={nv[n.campo]} onChange={e => setNv(s => ({ ...s, [n.campo]: e.target.value }))}
              rows={1} placeholder={n.rotulo} style={{ ...inp, resize: 'vertical', minHeight: 34 }} />
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
        <button type="button" className="btn primary" onClick={submit} disabled={salvando}>
          {salvando ? 'Salvando…' : inicial ? 'Salvar escala' : '+ Criar escala'}
        </button>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}
