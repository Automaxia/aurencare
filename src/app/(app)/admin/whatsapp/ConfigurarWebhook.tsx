'use client'

import { useState } from 'react'
import { configurarWebhookAction } from './actions'

export function ConfigurarWebhook({ atual }: { atual: string | null }) {
  const [estado, setEstado] = useState<'idle' | 'rodando'>('idle')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)

  async function aplicar() {
    setEstado('rodando'); setRes(null)
    const r = await configurarWebhookAction()
    setEstado('idle')
    setRes(r.ok
      ? { ok: true, msg: `Webhook apontado para ${r.url}. As respostas do paciente (SIM, PIX, CONFIRMAR…) agora chegam.` }
      : { ok: false, msg: `Falha: ${r.erro}` })
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: '4px solid var(--amber)' }}>
      <div className="sec-lbl" style={{ marginBottom: 6 }}>Webhook · respostas do paciente</div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 10px', lineHeight: 1.55 }}>
        Sem o webhook apontando pra cá, quando o paciente <strong>responde</strong> no WhatsApp
        (SIM, PIX, CONFIRMAR…) o app <strong>não recebe</strong> — e nada acontece. Isto é o que faz
        as respostas funcionarem.
      </p>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 12px', fontFamily: 'var(--font-mono), monospace', wordBreak: 'break-all' }}>
        Webhook atual na instância: {atual || '— (nenhum / não foi possível ler)'}
      </p>
      <button className="btn primary" onClick={aplicar} disabled={estado === 'rodando'}>
        {estado === 'rodando' ? 'Configurando…' : 'Apontar webhook pra cá'}
      </button>
      {res && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: res.ok ? 'var(--sage)' : 'var(--rose)', lineHeight: 1.5, wordBreak: 'break-all' }}>
          {res.ok ? '✓ ' : '✕ '}{res.msg}
        </p>
      )}
    </div>
  )
}
