'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarPacienteAction } from './actions'

export function NewPatientForm({ psicologoNome }: { psicologoNome: string }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const result = await criarPacienteAction({ nome, telefone, email: email || null })
    setLoading(false)
    if (result.ok) router.push('/pacientes')
    else setError(result.error)
  }

  const previewName = (nome.split(' ')[0] || 'Paciente').trim()
  const preview = `Olá, ${previewName}! Sou da equipe de ${psicologoNome}.

Para começar, leia e aceite os termos no link:
https://aurencare.ia.br/onboard/…

Qualquer dúvida, é só responder por aqui.`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14 }}>
        <Field label="Nome completo">
          <input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Fernanda K." />
        </Field>
        <Field label="Telefone (WhatsApp)">
          <input
            required
            value={telefone}
            onChange={e => setTelefone(e.target.value.replace(/[^\d() -]/g, ''))}
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
        </Field>
        <Field label="Email (opcional)">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
        </Field>

        {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <a href="/pacientes" className="btn ghost">Cancelar</a>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Criando…' : 'Criar e enviar WhatsApp'}
          </button>
        </div>

        <style jsx>{`
          input {
            width: 100%; padding: 8px 12px; border-radius: var(--field-radius);
            border: 1px solid var(--field-border); background: var(--field-bg);
            font-size: 13px; font-family: inherit; color: var(--ink);
            outline: none;
            transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
          }
          input:hover { border-color: var(--field-border-hover); }
          input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
          input:user-invalid { border-color: var(--rose); }
          input:user-invalid:focus { box-shadow: var(--field-ring-error); }
        `}</style>
      </form>

      <aside>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Pré-visualização da mensagem
        </div>
        <div className="card" style={{
          padding: 14, fontSize: 13, fontFamily: 'var(--font-mono), monospace',
          color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
          background: 'var(--surface)',
        }}>
          {preview}
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
    </label>
  )
}
