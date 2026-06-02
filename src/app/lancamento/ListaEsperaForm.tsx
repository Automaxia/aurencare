'use client'

import { useState } from 'react'
import { entrarListaEsperaAction } from './actions'

export function ListaEsperaForm() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [crp, setCrp] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro(null); setErroCampo(null)
    const r = await entrarListaEsperaAction({
      nome, email,
      crp: crp.trim() || null,
      mensagem: mensagem.trim() || null,
      origem: 'lancamento',
    })
    setEnviando(false)
    if (r.ok) {
      setSucesso(true)
      setNome(''); setEmail(''); setCrp(''); setMensagem('')
    } else {
      setErro(r.error)
      setErroCampo(r.campo ?? null)
    }
  }

  if (sucesso) {
    return (
      <div style={{
        padding: '28px 24px', borderRadius: 16,
        background: 'rgba(90,158,138,.10)',
        border: '1px solid rgba(90,158,138,.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
          color: '#2a6456', margin: '0 0 6px',
        }}>
          Você está na lista
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Avisamos por email quando abrirmos seu acesso. Se tiver dúvidas,
          escreva pra <strong>contato@automaxia.com.br</strong>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field label="Nome completo" error={erroCampo === 'nome' ? erro : null}>
        <input
          required value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Ex: Ana Pereira"
          autoComplete="name"
        />
      </Field>
      <Field label="Email" error={erroCampo === 'email' ? erro : null}>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="voce@email.com"
          autoComplete="email"
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12 }}>
        <Field label="CRP (opcional)">
          <input
            value={crp} onChange={e => setCrp(e.target.value)}
            placeholder="CRP 06/12345"
            style={{ width: 140 }}
          />
        </Field>
      </div>
      <Field label="O que quer testar primeiro? (opcional)">
        <textarea
          value={mensagem} onChange={e => setMensagem(e.target.value)}
          rows={2}
          placeholder="Ex: estou procurando uma forma de organizar pagamentos e WhatsApp em um só lugar."
        />
      </Field>

      {erro && !erroCampo && (
        <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>
      )}

      <button
        type="submit"
        disabled={enviando}
        style={{
          padding: '13px 20px',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: 'white',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
          transition: 'background .2s var(--ease)',
        }}
      >
        {enviando ? 'Enviando…' : 'Entrar na lista de espera →'}
      </button>

      <p style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.55, marginTop: 4 }}>
        Sem spam. Só o aviso quando seu acesso abrir.
      </p>

      <style jsx>{`
        input, textarea {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease);
        }
        input:focus, textarea:focus { border-color: var(--accent); }
        textarea { resize: vertical; min-height: 60px; }
      `}</style>
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{
        fontSize: 11, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500,
      }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}
