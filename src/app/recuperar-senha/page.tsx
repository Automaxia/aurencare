'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { Field } from '@/components/form/Field'
import { solicitarResetAction } from './actions'

const COOLDOWN = 60

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Contagem regressiva pro "Reenviar email".
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function enviar() {
    setLoading(true)
    await solicitarResetAction(email)
    setLoading(false)
    setEnviado(true)
    setCooldown(COOLDOWN)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await enviar()
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
          <Logo size={40} layout="stack" tagline="Memória Clínica Longitudinal para Psicólogos" />
        </div>

        {enviado ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 10 }}>Verifique sua caixa de entrada</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6 }}>
              Se houver uma conta com <strong>{email}</strong>, enviamos um link de
              recuperação. Ele vale por <strong>1 hora</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.55 }}>
              Caso não encontre a mensagem, verifique as pastas de <strong>spam</strong> ou <strong>promoções</strong>.
            </p>

            <button
              onClick={enviar}
              disabled={cooldown > 0 || loading}
              className="btn ghost"
              style={{ justifyContent: 'center', width: '100%', marginTop: 16, opacity: cooldown > 0 ? 0.6 : 1 }}
            >
              {loading ? 'Reenviando…' : cooldown > 0 ? `Reenviar email em ${cooldown}s` : 'Reenviar email'}
            </button>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 6 }}>Recuperar senha</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 8, lineHeight: 1.55 }}>
              Informe seu email e enviaremos um link <strong>seguro</strong> para criar uma nova senha.
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
              O link expira automaticamente após algum tempo, por motivos de segurança.
            </p>
            <form onSubmit={onSubmit} className="auth-form" style={{ display: 'grid', gap: 12 }}>
              <Field label="Email">
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email" autoFocus
                />
              </Field>
              <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
            </form>
          </>
        )}

        <div className="login-trust" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', color: 'var(--muted)', justifyContent: 'center' }}>
          <span>🔒 Dados protegidos</span>
          <span>🔒 LGPD</span>
          <span>🔒 Zero Data Training</span>
        </div>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/login" style={{ color: 'var(--accent)' }}>← Voltar para entrar</Link>
        </div>
      </div>
    </div>
  )
}
