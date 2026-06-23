'use client'

import { useState } from 'react'
import type { ConversaResumo, MensagemWa } from '@/server/services/conversasWa'
import { lerConversaAction, responderConversaAction } from './actions'

function formatTel(t: string): string {
  const d = t.replace(/\D/g, '')
  const n = d.startsWith('55') ? d.slice(2) : d
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return t
}
function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export function ConversasView({ inicial }: { inicial: ConversaResumo[] }) {
  const [convs, setConvs] = useState(inicial)
  const [sel, setSel] = useState<string | null>(null)
  const [thread, setThread] = useState<{ paciente: { id: string; nome: string } | null; mensagens: MensagemWa[] } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [resp, setResp] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function abrir(tel: string) {
    setSel(tel); setThread(null); setCarregando(true); setResp('')
    const t = await lerConversaAction(tel)
    setThread(t); setCarregando(false)
    // zera não-lidas localmente
    setConvs(prev => prev.map(c => c.telefone === tel ? { ...c, naoLidas: 0 } : c))
  }

  async function enviar() {
    if (!sel || !resp.trim() || enviando) return
    setEnviando(true)
    const r = await responderConversaAction(sel, resp.trim())
    setEnviando(false)
    if (r.ok) {
      const agora = new Date().toISOString()
      setThread(t => t ? { ...t, mensagens: [...t.mensagens, { id: agora, direcao: 'out', texto: resp.trim(), createdAt: agora }] } : t)
      setConvs(prev => prev.map(c => c.telefone === sel ? { ...c, ultimaTexto: resp.trim(), ultimaDirecao: 'out', ultimaEm: agora } : c))
      setResp('')
    } else {
      alert(r.error ?? 'Não foi possível enviar.')
    }
  }

  if (convs.length === 0) {
    return <div className="card" style={{ padding: 22, color: 'var(--muted)', fontSize: 13 }}>
      Nenhuma conversa ainda. Quando seus pacientes enviarem ou receberem mensagens no WhatsApp, elas aparecem aqui.
    </div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }} className="conversas-grid">
      {/* Lista */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: '72vh', overflowY: 'auto' }}>
        {convs.map(c => (
          <button key={c.telefone} onClick={() => abrir(c.telefone)} style={{
            display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
            background: sel === c.telefone ? 'var(--accent-lo)' : 'transparent',
            borderBottom: '1px solid var(--border)', padding: '12px 14px', fontFamily: 'inherit',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.pacienteNome ?? formatTel(c.telefone)}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{quando(c.ultimaEm)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 12, color: c.naoLidas > 0 ? 'var(--ink-soft)' : 'var(--muted)', fontWeight: c.naoLidas > 0 ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.ultimaDirecao === 'out' ? '↩ ' : ''}{c.ultimaTexto}
              </span>
              {c.naoLidas > 0 && (
                <span style={{ flex: 'none', minWidth: 18, height: 18, borderRadius: 999, background: 'var(--sage)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.naoLidas}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '72vh' }}>
        {!sel ? (
          <div style={{ margin: 'auto', color: 'var(--faint)', fontSize: 13 }}>Selecione uma conversa</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{thread?.paciente?.nome ?? formatTel(sel)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatTel(sel)} · WhatsApp</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)' }}>
              {carregando && <div style={{ color: 'var(--muted)', fontSize: 12, margin: 'auto' }}>Carregando…</div>}
              {thread?.mensagens.map(m => (
                <div key={m.id} style={{ alignSelf: m.direcao === 'out' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                  <div style={{
                    padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.direcao === 'out' ? 'var(--accent)' : 'var(--card)',
                    color: m.direcao === 'out' ? '#fff' : 'var(--ink-soft)',
                    border: m.direcao === 'out' ? 'none' : '1px solid var(--border)',
                  }}>{m.texto}</div>
                  <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2, textAlign: m.direcao === 'out' ? 'right' : 'left' }}>{quando(m.createdAt)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
              <input
                value={resp} onChange={e => setResp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escreva uma resposta…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none' }}
              />
              <button className="btn primary" onClick={enviar} disabled={enviando || !resp.trim()}>{enviando ? '…' : 'Enviar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
