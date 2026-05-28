'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { cadastrarAction } from './actions'

export function CadastroForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [crp, setCrp] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campoErro, setCampoErro] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setCampoErro(null)

    if (!aceitouTermos) {
      setError('Você precisa aceitar os termos para continuar.')
      return
    }

    setLoading(true)
    const r = await cadastrarAction({ nome, crp, email, telefone, senha })

    if (!r.ok) {
      setError(r.error)
      setCampoErro(r.campo ?? null)
      setLoading(false)
      return
    }

    // Auto-login após cadastro
    const signRes = await signIn('credentials', {
      email: r.email, password: senha, redirect: false, callbackUrl: '/',
    })
    setLoading(false)
    if (signRes?.error) {
      setError('Conta criada, mas não consegui te logar automaticamente. Tenta entrar.')
      setTimeout(() => router.push('/login'), 1500)
      return
    }
    router.push('/')
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <Field label="Nome completo" error={campoErro === 'nome' ? error : undefined}>
        <input required value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" placeholder="Ex: Ana Pereira" />
      </Field>

      <Field label="CRP" error={campoErro === 'crp' ? error : undefined}>
        <input required value={crp} onChange={e => setCrp(e.target.value)} placeholder="CRP 06/12345" />
      </Field>

      <Field label="Email" error={campoErro === 'email' ? error : undefined}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </Field>

      <Field
        label="Telefone WhatsApp"
        hint="O número que receberá as mensagens de pacientes. Pode ser igual ao do seu celular pessoal."
        error={campoErro === 'telefone' ? error : undefined}
      >
        <input
          type="tel" required value={telefone}
          onChange={e => setTelefone(e.target.value.replace(/[^\d() -]/g, ''))}
          placeholder="(11) 98765-4321"
          inputMode="tel" autoComplete="tel"
        />
      </Field>

      <Field label="Senha" error={campoErro === 'senha' ? error : undefined}>
        <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="mínimo 8 caracteres" autoComplete="new-password" />
      </Field>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 4, cursor: 'pointer' }}>
        <input
          type="checkbox" checked={aceitouTermos} onChange={e => setAceitouTermos(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          Concordo com o uso da plataforma para apoio à minha prática.
          Os dados das sessões ficam <strong>criptografados</strong>, sob minha responsabilidade clínica,
          e <strong>não são usados para treinar IA</strong>. CFP 09/2024.
        </span>
      </label>

      {error && !campoErro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

      <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center', marginTop: 6 }}>
        {loading ? 'Criando sua conta…' : 'Criar conta'}
      </button>

      <style jsx>{`
        input {
          width: 100%; padding: 9px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: white;
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
        }
        input:focus { border-color: var(--accent); }
        input[type=checkbox] { width: auto; padding: 0; }
      `}</style>
    </form>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}
