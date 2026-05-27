'use client'

import { useEffect, useRef, useState } from 'react'
import { CfpBadge } from '@/components/brand/CfpBadge'

type Msg = { role: 'user' | 'assistant'; content: string }

export function TemasChat({ pacienteId, selecionado }: { pacienteId: string; selecionado: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  async function enviar() {
    const text = draft.trim()
    if (!text || loading) return
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next); setDraft(''); setLoading(true)
    try {
      const res = await fetch('/api/analise/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto: 'temas', pacienteId, foco: selecionado, messages: next }),
      })
      const json = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: json.text ?? '[Sem resposta]' }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: '[Erro ao consultar IA]' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Chat de apoio · temas
        </div>
        <CfpBadge />
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 4 }}>
        {msgs.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Pergunte sobre frequências, co-ocorrências ou tendências dos temas. Esta IA não emite diagnóstico.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'var(--accent-lo)' : 'var(--surface)',
            padding: '8px 12px', borderRadius: 10, fontSize: 13, maxWidth: '90%', whiteSpace: 'pre-wrap',
          }}>{m.content}</div>
        ))}
        {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>… analisando</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); enviar() }} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={selecionado ? `Perguntar sobre "${selecionado}"…` : 'Perguntar sobre os temas…'}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'white', fontSize: 13, outline: 'none',
          }}
        />
        <button type="submit" className="btn primary" disabled={loading || !draft.trim()}>Enviar</button>
      </form>
    </div>
  )
}
