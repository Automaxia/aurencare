'use client'

import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { CfpBadge } from '@/components/brand/CfpBadge'
import { VideoCall } from '@/components/video/VideoCall'
import { TermoUsoVideo } from './TermoUsoVideo'

type Props = {
  token: string
  psicologaNome: string
  pacienteNome: string
  jaAceitou: boolean
}

export function SalaPaciente({ token, psicologaNome, pacienteNome, jaAceitou }: Props) {
  const [entrou, setEntrou] = useState(false)
  const [aceito, setAceito] = useState(jaAceitou)
  const [registrando, setRegistrando] = useState(false)
  const [erroAceite, setErroAceite] = useState<string | null>(null)

  async function entrarNaSala() {
    if (!aceito) return
    setErroAceite(null)
    setRegistrando(true)
    // Registra o aceite (IP+UA) como evidência, mas NÃO bloqueia a entrada por
    // causa disso — rede instável não pode trancar o paciente na tela do termo.
    // Best-effort, com timeout curto; entra de qualquer forma.
    if (!jaAceitou) {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 4000)
        await fetch(`/api/sala/${token}/aceite-termo`, { method: 'POST', signal: ctrl.signal })
        clearTimeout(t)
      } catch { /* aceite é best-effort; segue mesmo assim */ }
    }
    setRegistrando(false)
    setEntrou(true)
  }

  if (!entrou) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)', padding: 16 }}>
        <div className="card" style={{ maxWidth: 520, padding: 32, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Logo size={32} layout="stack" />
          </div>
          <h2 style={{ textAlign: 'center', marginTop: 12, marginBottom: 4 }}>Sua sessão</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>
            Olá{pacienteNome ? `, ${pacienteNome.split(' ')[0]}` : ''}. Sua sessão com {psicologaNome.split(' ').slice(0, 2).join(' ')} acontece nesta sala. Antes de entrar, leia o termo abaixo e confirme seu aceite.
          </p>

          <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--rsm)', listStyle: 'none', margin: '0 0 14px' }}>
            <li>· Use fones de ouvido se possível, melhora a qualidade.</li>
            <li>· Sua psicóloga vai te ver e ouvir quando ambos estiverem na sala.</li>
            <li>· O áudio é processado para apoio à continuidade; nada é gravado em vídeo.</li>
          </ul>

          <TermoUsoVideo psicologaNome={psicologaNome} />

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', borderRadius: 'var(--rsm)',
            background: aceito ? 'rgba(90,158,138,.08)' : 'var(--surface)',
            border: `1px solid ${aceito ? 'rgba(90,158,138,.30)' : 'var(--border)'}`,
            cursor: 'pointer', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55,
            transition: 'all .15s var(--ease)',
          }}>
            <input
              type="checkbox" checked={aceito}
              onChange={e => setAceito(e.target.checked)}
              disabled={jaAceitou}
              style={{ marginTop: 2, accentColor: 'var(--sage)' }}
            />
            <span>
              Li e concordo com o <strong>Termo de Consentimento Informado</strong> para
              atendimento psicológico online, incluindo o uso de IA como apoio à
              continuidade clínica conforme Resolução CFP 09/2024 e LGPD.
              {jaAceitou && (
                <span style={{ display: 'block', marginTop: 4, color: 'var(--sage)', fontSize: 11 }}>
                  ✓ Aceite já registrado para esta sala.
                </span>
              )}
            </span>
          </label>

          {erroAceite && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(196,96,122,.08)', color: 'var(--rose)', fontSize: 12,
            }}>{erroAceite}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <button
              className="btn primary"
              onClick={entrarNaSala}
              disabled={!aceito || registrando}
              style={{ padding: '10px 24px' }}
              title={!aceito ? 'Marque o aceite do termo para continuar' : undefined}
            >
              {registrando ? 'Entrando…' : 'Entrar na sala'}
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
