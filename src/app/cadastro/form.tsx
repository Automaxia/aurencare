'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Field } from '@/components/form/Field'
import { PasswordInput } from '@/components/form/PasswordInput'
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
    <form onSubmit={onSubmit} className="auth-form" style={{ display: 'grid', gap: 12 }}>
      <Field label="Nome completo" error={campoErro === 'nome' ? error : undefined}>
        <input required value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" placeholder="Ex: Ana Pereira" />
      </Field>

      <Field
        label="CRP"
        hint="Seu registro profissional — validamos o acesso exclusivo para psicólogos."
        error={campoErro === 'crp' ? error : undefined}
      >
        <input required value={crp} onChange={e => setCrp(e.target.value)} placeholder="CRP 06/12345" />
      </Field>

      <Field label="Email" error={campoErro === 'email' ? error : undefined}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </Field>

      <Field
        label="WhatsApp profissional"
        hint="Receberá mensagens, lembretes e comunicações da sua prática. Pode ser o mesmo número do celular pessoal."
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
        <PasswordInput required value={senha} onChange={e => setSenha(e.target.value)} placeholder="mínimo 8 caracteres" autoComplete="new-password" />
      </Field>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 4, cursor: 'pointer' }}>
        <input
          type="checkbox" checked={aceitouTermos} onChange={e => setAceitouTermos(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          Estou ciente de que os dados permanecem <strong>criptografados</strong>, sob minha
          responsabilidade clínica, e <strong>não são utilizados para treinamento de modelos de IA</strong>.
        </span>
      </label>
      <a href="/lancamento#privacidade" target="_blank" rel="noreferrer"
        style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: -4, marginLeft: 24, textDecoration: 'none' }}>
        Ver detalhes de privacidade →
      </a>

      {error && !campoErro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

      <button type="submit" className="btn primary" disabled={loading} style={{ justifyContent: 'center', marginTop: 6 }}>
        {loading ? 'Criando sua conta…' : 'Criar minha conta'}
      </button>
    </form>
  )
}
