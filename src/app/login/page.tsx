'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

/**
 * Pra fazer o build estático, useSearchParams() exige envelopar em Suspense.
 * O page raiz vira só a casca; o form mora num componente filho.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params?.get('callbackUrl') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      backgroundColor: 'var(--page)',
      backgroundImage: 'url(/landing/login-bg.webp)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
    }}>
      <div className="card" style={{ width: 'min(360px, 92vw)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={40} layout="stack" tagline />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Entrar</h2>

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

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          Não tem conta? <Link href="/cadastro" style={{ color: 'var(--accent)' }}>Criar agora</Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      <style jsx>{`
        input {
          width: 100%; box-sizing: border-box; display: block;
          padding: 11px 13px; border-radius: 8px;
          border: 1px solid var(--border); background: white;
          font-size: 15px; font-family: inherit; color: var(--ink);
          outline: none; transition: border-color .15s var(--ease);
        }
        input:focus { border-color: var(--accent); }
      `}</style>
    </label>
  )
}
