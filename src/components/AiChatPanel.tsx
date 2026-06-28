'use client'

import { useEffect, useRef, useState } from 'react'
import { iaIndisponivel, MSG_IA_INDISPONIVEL } from '@/lib/ia'

/**
 * Painel de chat com IA — dark theme, alinhado ao mockup v12.5.
 * Usado em /pacientes/[id]/temas e /pacientes/[id]/evolucao.
 * §9 — IA não emite diagnóstico; aiGuard validado no servidor.
 */

export type AiChatMessage = { role: 'user' | 'assistant'; content: string; erro?: boolean }

export type AiChatProps = {
  endpoint: string                       // POST endpoint que retorna { text: string }
  payload: Record<string, any>           // extra fields enviados em cada POST (pacienteId, contexto, etc)
  title?: string
  subtitle?: React.ReactNode
  initialMessage?: string
  quickPrompts?: string[]
  placeholder?: string
}

export function AiChatPanel({
  endpoint, payload, title = 'Apoio à reflexão', subtitle, initialMessage, quickPrompts = [], placeholder = 'Pergunte algo…',
}: AiChatProps) {
  const [msgs, setMsgs] = useState<AiChatMessage[]>(
    initialMessage ? [{ role: 'assistant', content: initialMessage }] : [],
  )
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading])

  async function send(text: string) {
    const t = text.trim()
    if (!t || loading) return
    const next: AiChatMessage[] = [...msgs, { role: 'user', content: t }]
    setMsgs(next); setDraft(''); setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, messages: next }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || iaIndisponivel(json?.text)) {
        setMsgs(m => [...m, { role: 'assistant', content: MSG_IA_INDISPONIVEL, erro: true }])
      } else {
        setMsgs(m => [...m, { role: 'assistant', content: json.text }])
      }
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: MSG_IA_INDISPONIVEL, erro: true }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat-head">
        <div className="ai-title">
          <span className="ai-dot" />
          {title}
        </div>
        {subtitle && <div className="ai-subtitle">{subtitle}</div>}
      </div>

      <div ref={scrollRef} className="ai-msgs">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'assistant' ? 'ai-msg-ai' : 'ai-msg-user'}
               style={m.erro ? { opacity: .85, fontStyle: 'italic' } : undefined}>
            {m.content}
          </div>
        ))}
        {loading && <div className="ai-typing">… analisando</div>}
      </div>

      {quickPrompts.length > 0 && (
        <div className="ai-quick">
          {quickPrompts.map((q, i) => (
            <button key={i} className="ai-qbtn" onClick={() => send(q)} disabled={loading}>{q}</button>
          ))}
        </div>
      )}

      <div className="ai-input-row">
        <textarea
          className="ai-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={2}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(draft) }
          }}
        />
        <button className="ai-send" onClick={() => send(draft)} disabled={loading || !draft.trim()} aria-label="Enviar">↑</button>
      </div>
    </div>
  )
}
