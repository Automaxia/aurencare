'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params?.get('callbackUrl') ?? '/'

  const [email, setEmail] = useState('ana@aurencare.com')
  const [password, setPassword] = useState('auren123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl })
    setLoading(false)
    if (res?.error) setError('Credenciais inválidas.')
    else router.push(res?.url || callbackUrl)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(180deg, var(--page) 0%, var(--surface) 100%)',
    }}>
      <div className="card" style={{ width: 360, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo size={32} />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Entrar</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginBottom: 20 }}>
          Sistema operacional da prática clínica.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Email">
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Senha">
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
          <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{
        display: 'block', border: '1px solid var(--border)', borderRadius: 8,
        padding: '8px 12px', background: 'white',
      }}>
        {(() => {
          // Permite estilizar o input nativo via parent.
          // (passthrough; React não permite cloneElement em ReactNode sem cast.)
          return children
        })()}
      </span>
      <style jsx>{`
        input {
          width: 100%; border: 0; outline: none; background: transparent;
          font-size: 13px; color: var(--ink);
        }
      `}</style>
    </label>
  )
}
