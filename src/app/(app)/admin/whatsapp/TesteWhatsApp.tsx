'use client'

import { useState } from 'react'
import { enviarTesteWAAction } from './actions'

export function TesteWhatsApp({ habilitado }: { habilitado: boolean }) {
  const [tel, setTel] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando'>('idle')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)

  async function enviar() {
    setEstado('enviando'); setRes(null)
    const r = await enviarTesteWAAction(tel)
    setEstado('idle')
    setRes(r.ok ? { ok: true, msg: 'Enviado! Confira o WhatsApp do número.' } : { ok: false, msg: r.erro ?? 'Falha ao enviar.' })
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="sec-lbl" style={{ marginBottom: 10 }}>Enviar teste</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={tel}
          onChange={e => setTel(e.target.value.replace(/[^\d()+\s-]/g, ''))}
          placeholder="(11) 99999-9999"
          inputMode="tel"
          style={{
            flex: '1 1 220px', padding: '9px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
          }}
        />
        <button className="btn primary" onClick={enviar} disabled={estado === 'enviando' || tel.replace(/\D/g, '').length < 10}>
          {estado === 'enviando' ? 'Enviando…' : 'Enviar teste'}
        </button>
      </div>
      {!habilitado && (
        <p style={{ fontSize: 12, color: 'var(--amber)', marginTop: 8 }}>Integração em modo demonstração — o teste vai falhar até configurar as chaves.</p>
      )}
      {res && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: res.ok ? 'var(--sage)' : 'var(--rose)', lineHeight: 1.5, wordBreak: 'break-all' }}>
          {res.ok ? '✓ ' : '✕ '}{res.msg}
        </p>
      )}
    </div>
  )
}
