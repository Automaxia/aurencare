'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function OnboardForm({ token, nome }: { token: string; nome: string }) {
  const router = useRouter()
  const [accept1, setAccept1] = useState(false)
  const [accept2, setAccept2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onAccept() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/onboard/${token}/aceitar`, { method: 'POST' })
      if (!res.ok) throw new Error('falhou')
      router.refresh()
    } catch {
      setError('Não foi possível registrar agora. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Olá, {nome.split(' ')[0]}</h2>
      <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13, marginBottom: 20 }}>
        Antes de começarmos, leia e aceite os termos abaixo.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        <Check checked={accept1} onChange={setAccept1}>
          Concordo com o uso de WhatsApp para receber lembretes, cobranças e
          comunicações sobre minhas sessões. Posso revogar a qualquer momento.
        </Check>
        <Check checked={accept2} onChange={setAccept2}>
          Concordo com o armazenamento criptografado dos meus dados clínicos
          (LGPD), <strong>sem uso para treinamento de IA</strong>, em servidores
          do profissional responsável pelo meu atendimento.
        </Check>

        {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

        <button
          className="btn primary"
          onClick={onAccept}
          disabled={!accept1 || !accept2 || loading}
          style={{ justifyContent: 'center' }}
        >
          {loading ? 'Registrando…' : 'Aceitar e continuar'}
        </button>
      </div>
    </>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <span>{children}</span>
    </label>
  )
}
