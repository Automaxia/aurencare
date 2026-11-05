'use client'

import { useState } from 'react'
import { rodarManutencaoAction } from './actions'

export function RodarManutencao() {
  const [rodando, setRodando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  async function rodar() {
    setRodando(true); setMsg(null)
    const r = await rodarManutencaoAction()
    setRodando(false)
    setMsg(r.ok ? { ok: true, texto: r.resumo ?? 'Feito.' } : { ok: false, texto: r.error ?? 'Falhou.' })
  }
  // Botão no cabeçalho; o resultado aparece embaixo dele, sem empurrar o título.
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="btn" onClick={rodar} disabled={rodando}>
        {rodando ? 'Rodando…' : 'Rodar manutenção agora'}
      </button>
      {msg && (
        <span role="status" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 5, width: 'max-content', maxWidth: 420,
          padding: '8px 12px', borderRadius: 8, background: 'var(--card)', boxShadow: 'var(--sh)',
          fontSize: 11.5, lineHeight: 1.5, color: msg.ok ? '#2a6456' : 'var(--rose)', whiteSpace: 'normal',
        }}>
          {msg.texto}
        </span>
      )}
    </span>
  )
}
