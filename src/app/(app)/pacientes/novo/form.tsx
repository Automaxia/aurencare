'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/Toast'
import { criarPacienteAction } from './actions'

// Mantido em sincronia com LINK_TOKEN em server/services/pacientes.ts.
const LINK_TOKEN = '[link de termos]'

export function NewPatientForm({ psicologoNome }: { psicologoNome: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = usa o texto padrão (que acompanha o nome digitado); string = editado pelo psicólogo.
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const result = await criarPacienteAction({ nome, telefone, email: email || null, mensagem })
    setLoading(false)
    if (result.ok) {
      toast(`${(nome.split(' ')[0] || 'Paciente').trim()} cadastrado — convite enviado no WhatsApp`)
      router.push('/pacientes')
    } else setError(result.error)
  }

  const previewName = (nome.split(' ')[0] || 'Paciente').trim()
  const mensagemPadrao = `Olá, ${previewName}! Sou da equipe de ${psicologoNome}.

Para começar, leia e aceite os termos no link:
${LINK_TOKEN}

Qualquer dúvida, é só responder por aqui.`
  const mensagemValor = mensagem ?? mensagemPadrao
  const editada = mensagem !== null

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
        <style jsx global>{`
          .wa-msg {
            width: 100%; box-sizing: border-box; padding: 14px;
            border-radius: var(--field-radius); border: 1px solid var(--field-border);
            background: var(--surface); color: var(--ink-soft);
            font-size: 13px; font-family: var(--font-mono), monospace; line-height: 1.5;
            outline: none; resize: vertical; min-height: 180px;
            transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
          }
          .wa-msg:hover { border-color: var(--field-border-hover); }
          .wa-msg:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        `}</style>
      </form>

      <aside>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Mensagem do WhatsApp · editável
          </div>
          {editada && (
            <button type="button" onClick={() => setMensagem(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11.5, padding: 0 }}>
              Restaurar padrão
            </button>
          )}
        </div>
        <textarea
          className="wa-msg"
          value={mensagemValor}
          onChange={e => setMensagem(e.target.value)}
          rows={9}
          aria-label="Mensagem de boas-vindas do WhatsApp"
        />
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.5, marginTop: 8 }}>
          Edite à vontade. Mantenha <code>{LINK_TOKEN}</code> onde o link de aceite dos termos deve aparecer —
          se você remover, ele é adicionado automaticamente ao final.
        </p>
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
