'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Field } from '@/components/form/Field'
import { PasswordInput } from '@/components/form/PasswordInput'
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
      <form onSubmit={onSubmit} className="auth-form" style={{ display: 'grid', gap: 12 }}>
        <Field label="Nova senha">
          <PasswordInput required value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" autoFocus placeholder="mínimo 8 caracteres" />
        </Field>
        <Field label="Confirmar senha">
          <PasswordInput required value={confirma} onChange={e => setConfirma(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
        <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center' }}>
          {loading ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>
    </>
  )
}
