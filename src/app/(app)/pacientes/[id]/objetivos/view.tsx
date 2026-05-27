'use client'

import { useState } from 'react'
import type { Objetivo } from '@/server/services/objetivos'
import { criarObjetivoAction, atualizarObjetivoAction, deletarObjetivoAction } from './actions'

export function ObjetivosView({ pacienteId, initial }: { pacienteId: string; initial: Objetivo[] }) {
  const [objs, setObjs] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')

  async function criar() {
    if (!titulo.trim()) return
    const novo = await criarObjetivoAction(pacienteId, titulo.trim(), descricao.trim() || null)
    if (novo) {
      setObjs([novo, ...objs])
      setTitulo(''); setDescricao(''); setShowForm(false)
    }
  }
  async function updateProgress(o: Objetivo, p: number) {
    const upd = await atualizarObjetivoAction(o.id, { progresso: p })
    if (upd) setObjs(objs.map(x => x.id === o.id ? upd : x))
  }
  async function updateStatus(o: Objetivo, s: Objetivo['status']) {
    const upd = await atualizarObjetivoAction(o.id, { status: s })
    if (upd) setObjs(objs.map(x => x.id === o.id ? upd : x))
  }
  async function remover(o: Objetivo) {
    if (!confirm(`Remover objetivo "${o.titulo}"?`)) return
    await deletarObjetivoAction(o.id)
    setObjs(objs.filter(x => x.id !== o.id))
  }

  const ativos    = objs.filter(o => o.status === 'ativo')
  const pausados  = objs.filter(o => o.status === 'pausado')
  const concluidos = objs.filter(o => o.status === 'concluido')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Fechar' : '+ Novo objetivo'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <input
            value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Título do objetivo (ex: Tolerar críticas sem reagir defensivamente)"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, outline: 'none' }}
          />
          <textarea
            value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={criar}>Criar</button>
          </div>
        </div>
      )}

      <Section title="Ativos" items={ativos} onProgress={updateProgress} onStatus={updateStatus} onDelete={remover} />
      {pausados.length > 0 && <Section title="Pausados" items={pausados} onProgress={updateProgress} onStatus={updateStatus} onDelete={remover} />}
      {concluidos.length > 0 && <Section title="Concluídos" items={concluidos} onProgress={updateProgress} onStatus={updateStatus} onDelete={remover} />}

      {objs.length === 0 && (
        <div className="empty">Nenhum objetivo cadastrado ainda.</div>
      )}
    </div>
  )
}

function Section({ title, items, onProgress, onStatus, onDelete }: {
  title: string; items: Objetivo[]; onProgress: (o: Objetivo, p: number) => void; onStatus: (o: Objetivo, s: Objetivo['status']) => void; onDelete: (o: Objetivo) => void
}) {
  if (items.length === 0) return null
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {items.map(o => (
          <li key={o.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{o.titulo}</div>
                {o.descricao && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{o.descricao}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
                {o.status !== 'concluido' && <button className="btn ghost" onClick={() => onStatus(o, 'concluido')}>Concluir</button>}
                {o.status === 'ativo' && <button className="btn ghost" onClick={() => onStatus(o, 'pausado')}>Pausar</button>}
                {o.status !== 'ativo' && <button className="btn ghost" onClick={() => onStatus(o, 'ativo')}>Reativar</button>}
                <button className="btn ghost" onClick={() => onDelete(o)}>×</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <input
                type="range" min={0} max={100} step={5} value={o.progresso}
                onChange={e => onProgress(o, +e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', width: 36, textAlign: 'right' }}>{o.progresso}%</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
