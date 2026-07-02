'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Lock, ShieldCheck, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { LogoMark } from '@/components/brand/Logo'
import { SpiralWatermark } from '@/components/brand/SpiralWatermark'
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
  'Contexto pronto antes de cada sessão',
  'Temas recorrentes conectados ao longo do tempo',
  'Objetivos e evolução acompanhados de verdade',
  'Uma linha do tempo clínica por paciente',
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
      <aside className="login-aside" style={{ position: 'relative', overflow: 'hidden' }}>
        <SpiralWatermark size={320} opacity={0.05} top={-40} right={-60} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, position: 'relative', zIndex: 1 }}>
          <LogoMark size={42} />
          <div>
            <div className="wm"><i>Au</i><b>dere</b></div>
            <div className="eyebrow" style={{ marginTop: 5 }}>Continuidade terapêutica</div>
          </div>
        </div>

        <div className="login-pitch" style={{ display: 'grid', gap: 22, position: 'relative', zIndex: 1 }}>
          <h1 className="login-head">Chegue em cada sessão sabendo <em style={{ fontStyle: 'italic' }}>exatamente onde o paciente parou.</em></h1>
          <p className="login-sub">
            A Audere reúne sessões, temas, objetivos e evolução numa linha do tempo
            clínica viva. A continuidade do cuidado deixa de depender da sua memória.
          </p>
          <ul className="login-diffs">
            {DIFERENCIAIS.map(d => (
              <li key={d}><span className="ck">✓</span>{d}</li>
            ))}
          </ul>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic', color: 'rgba(255,255,255,.8)', margin: 0, lineHeight: 1.45 }}>
            A tecnologia cuida do contexto. <span style={{ fontStyle: 'normal', fontWeight: 500, color: '#fff' }}>O psicólogo cuida da pessoa.</span>
          </p>
          <div className="login-trust">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={13} /> Dados protegidos</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={13} /> LGPD + CFP</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BadgeCheck size={13} /> A decisão clínica é sempre sua</span>
          </div>
        </div>
      </aside>

      {/* ── Direita — acesso ── */}
      <main className="login-main">
        <div className="card" style={{ width: 'min(380px, 92vw)', padding: 28 }}>
          <h2 style={{ marginBottom: 4 }}>Entrar</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>
            Continuidade terapêutica para psicólogos.
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
