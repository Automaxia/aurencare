'use client'

import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { CfpBadge } from '@/components/brand/CfpBadge'
import { VideoCall } from '@/components/video/VideoCall'

type Props = {
  token: string
  psicologaNome: string
  pacienteNome: string
}

export function SalaPaciente({ token, psicologaNome, pacienteNome }: Props) {
  const [entrou, setEntrou] = useState(false)

  if (!entrou) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)', padding: 16 }}>
        <div className="card" style={{ maxWidth: 480, padding: 32, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Logo size={32} layout="stack" />
          </div>
          <h2 style={{ textAlign: 'center', marginTop: 12, marginBottom: 4 }}>Sua sessão</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>
            Olá{pacienteNome ? `, ${pacienteNome.split(' ')[0]}` : ''}. Sua sessão com {psicologaNome.split(' ').slice(0, 2).join(' ')} acontece nesta sala. Quando estiver pronto, entre.
          </p>

          <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--rsm)', listStyle: 'none', margin: 0 }}>
            <li>· Use fones de ouvido se possível, melhora a qualidade.</li>
            <li>· Sua psicóloga vai te ver e ouvir quando ambos estiverem na sala.</li>
            <li>· O áudio é processado para apoio à continuidade; nada é gravado em vídeo.</li>
          </ul>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <button className="btn primary" onClick={() => setEntrou(true)} style={{ padding: '10px 24px' }}>
              Entrar na sala
            </button>
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
            <CfpBadge />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0e0c18', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.7)' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          Sessão com {psicologaNome.split(' ').slice(0, 2).join(' ')}
        </div>
        <CfpBadge />
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <VideoCall token={token} role="paciente" caller={false} onEncerrar={() => setEntrou(false)} />
      </div>
    </div>
  )
}
