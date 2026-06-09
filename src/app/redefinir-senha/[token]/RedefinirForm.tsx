'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { redefinirSenhaAction } from './actions'

export function RedefinirForm({ token }: { token: string }) {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (senha.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (senha !== confirma) { setError('As senhas não conferem.'); return }

    setLoading(true)
    const r = await redefinirSenhaAction(token, senha)
    if (!r.ok) { setError(r.error); setLoading(false); return }

    // Sucesso → loga automaticamente com a nova senha.
    const signRes = await signIn('credentials', { email: r.email, password: senha, redirect: false, callbackUrl: '/' })
    setLoading(false)
    if (signRes?.error) { router.push('/login'); return }
    router.push('/')
  }

  return (
    <>
      <h2 style={{ textAlign: 'center', marginBottom: 6 }}>Criar nova senha</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>
        Escolha uma senha com pelo menos 8 caracteres.
      </p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nova senha</span>
          <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" autoFocus placeholder="mínimo 8 caracteres" />
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Confirmar senha</span>
          <input type="password" required value={confirma} onChange={e => setConfirma(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
        <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
          {loading ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>

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
    </>
  )
}
