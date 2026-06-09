'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { solicitarResetAction } from './actions'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await solicitarResetAction(email)
    setLoading(false)
    setEnviado(true)
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

        {enviado ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 10 }}>Verifique seu email</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6 }}>
              Se houver uma conta com <strong>{email}</strong>, enviamos um link para
              redefinir a senha. Ele vale por <strong>1 hora</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
              Não chegou? Confira o spam ou{' '}
              <button
                onClick={() => setEnviado(false)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                tente de novo
              </button>.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 6 }}>Recuperar senha</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>
              Informe seu email e enviaremos um link para criar uma nova senha.
            </p>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Email</span>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email" autoFocus
                />
              </label>
              <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
                {loading ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
            </form>
          </>
        )}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/login" style={{ color: 'var(--accent)' }}>← Voltar para entrar</Link>
        </div>
      </div>

      <style jsx>{`
        form input {
          width: 100%; box-sizing: border-box; display: block;
          padding: 11px 13px; border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-size: 15px; font-family: inherit; color: var(--ink);
          outline: none; transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        form input:hover { border-color: var(--field-border-hover); }
        form input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        form input:user-invalid { border-color: var(--rose); }
        form input:user-invalid:focus { box-shadow: var(--field-ring-error); }
      `}</style>
    </div>
  )
}
