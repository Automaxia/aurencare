'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { LogoMark } from '@/components/brand/Logo'
import { Field } from '@/components/form/Field'
import { PasswordInput } from '@/components/form/PasswordInput'

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

const DIFERENCIAIS = [
  'Continuidade Terapêutica',
  'Objetivos Terapêuticos',
  'Evolução Registrada',
  'Memória Clínica Longitudinal',
  'Apoio clínico baseado em IA',
]

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
    <div className="login-split">
      {/* ── Esquerda — posicionamento / branding ── */}
      <aside className="login-aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <LogoMark size={42} />
          <div>
            <div className="wm"><i>Au</i><b>dere</b></div>
            <div className="eyebrow" style={{ marginTop: 5 }}>Sistema Operacional da Prática Clínica</div>
          </div>
        </div>

        <div className="login-pitch" style={{ display: 'grid', gap: 22 }}>
          <h1 className="login-head">Nunca mais comece uma sessão tentando lembrar onde parou.</h1>
          <p className="login-sub">
            Organize sua memória clínica, acompanhe objetivos terapêuticos e visualize a
            evolução dos seus pacientes ao longo do tempo.
          </p>
          <ul className="login-diffs">
            {DIFERENCIAIS.map(d => (
              <li key={d}><span className="ck">✓</span>{d}</li>
            ))}
          </ul>
          <div className="login-trust">
            <span>🔒 Dados protegidos</span>
            <span>🔒 Conformidade com LGPD</span>
            <span>🔒 Controle clínico sempre do psicólogo</span>
          </div>
        </div>
      </aside>

      {/* ── Direita — acesso ── */}
      <main className="login-main">
        <div className="card" style={{ width: 'min(380px, 92vw)', padding: 28 }}>
          <h2 style={{ marginBottom: 4 }}>Entrar</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>
            Memória Clínica Longitudinal para Psicólogos.
          </p>

          <form onSubmit={onSubmit} className="auth-form" style={{ display: 'grid', gap: 12 }}>
            <Field label="Email">
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Senha">
              <PasswordInput
                required value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {error && (
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--rose)' }}>{error}</div>
                <div style={{ color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Se tem certeza da senha e não entra, tente uma <strong>aba anônima</strong> — cookies antigos podem travar o login.
                </div>
              </div>
            )}
            <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12 }}>
            <Link href="/recuperar-senha" style={{ color: 'var(--muted)' }}>Esqueci minha senha</Link>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Novo na Audere?</div>
            <Link href="/cadastro" className="login-cta">Criar conta gratuitamente →</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
