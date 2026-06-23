'use client'

import { useState } from 'react'
import { rodarLembrete15Action } from './actions'

export function RodarLembrete() {
  const [estado, setEstado] = useState<'idle' | 'rodando'>('idle')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)

  async function rodar() {
    setEstado('rodando'); setRes(null)
    const r = await rodarLembrete15Action()
    setEstado('idle')
    if (r.ok) {
      setRes({ ok: true, msg: r.count === 0
        ? 'Rodou ok, mas 0 sessões na janela de 12–18 min (nenhuma elegível agora).'
        : `Enviado para ${r.count} sessão(ões) na janela.` })
    } else {
      setRes({ ok: false, msg: `Erro: ${r.erro}` })
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="sec-lbl" style={{ marginBottom: 6 }}>Lembrete de 15 min (forçar agora)</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Roda o mesmo job do cron. Envia para sessões que começam em <strong>12–18 minutos</strong>
        (status confirmada/agendada, ainda não avisadas).
      </p>
      <button className="btn primary" onClick={rodar} disabled={estado === 'rodando'}>
        {estado === 'rodando' ? 'Rodando…' : 'Rodar lembrete de 15 min'}
      </button>
      {res && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: res.ok ? 'var(--sage)' : 'var(--rose)', lineHeight: 1.5, wordBreak: 'break-all' }}>
          {res.ok ? '✓ ' : '✕ '}{res.msg}
        </p>
      )}
    </div>
  )
}
