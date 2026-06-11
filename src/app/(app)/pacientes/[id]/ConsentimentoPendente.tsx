'use client'

import { useState } from 'react'
import { reenviarConsentimentoAction } from './actions'

/**
 * Pílula "Aguardando consentimento" com ação de reenviar o convite (WhatsApp + email).
 * Para os casos em que o paciente não recebeu / não aceitou os termos.
 */
export function ConsentimentoPendente({ pacienteId }: { pacienteId: string }) {
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  async function reenviar() {
    setEstado('enviando'); setMsg(null)
    const r = await reenviarConsentimentoAction(pacienteId)
    if (r.ok) {
      setEstado('ok')
      setMsg(`Reenviado por ${r.canais.join(' e ')}.`)
    } else {
      setEstado('erro')
      setMsg(r.error)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, background: 'rgba(176,125,64,.14)', color: 'var(--amber)' }}>
        Aguardando consentimento
      </span>
      {estado === 'ok' ? (
        <span style={{ fontSize: 11.5, color: 'var(--sage)' }}>✓ {msg}</span>
      ) : (
        <button
          onClick={reenviar}
          disabled={estado === 'enviando'}
          style={{
            fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
            background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {estado === 'enviando' ? 'Reenviando…' : '↻ Reenviar convite'}
        </button>
      )}
      {estado === 'erro' && msg && <span style={{ fontSize: 11.5, color: 'var(--rose)' }}>{msg}</span>}
    </span>
  )
}
