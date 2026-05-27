'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarSessaoAction } from './actions'

export function NewSessionForm({ pacientes }: { pacientes: { id: string; nome: string }[] }) {
  const router = useRouter()
  const today = new Date()
  const defaultDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [pacienteId, setPacienteId] = useState(pacientes[0]?.id ?? '')
  const [data, setData] = useState(defaultDate)
  const [hora, setHora] = useState('14:00')
  const [duracao, setDuracao] = useState(50)
  const [modalidade, setModalidade] = useState('online')
  const [valor, setValor] = useState(220)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const iso = new Date(`${data}T${hora}:00`).toISOString()
    const r = await criarSessaoAction({ pacienteId, dataHora: iso, duracaoMin: duracao, modalidade, valor })
    setLoading(false)
    if (r.ok) router.push('/agenda')
    else setError(r.error)
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
      <Field label="Paciente">
        <select value={pacienteId} onChange={e => setPacienteId(e.target.value)} required>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} required /></Field>
        <Field label="Hora"><input type="time" value={hora} onChange={e => setHora(e.target.value)} required /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Duração (min)"><input type="number" value={duracao} onChange={e => setDuracao(+e.target.value)} min={15} max={180} step={5} /></Field>
        <Field label="Modalidade">
          <select value={modalidade} onChange={e => setModalidade(e.target.value)}>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </select>
        </Field>
        <Field label="Valor (R$)"><input type="number" value={valor} onChange={e => setValor(+e.target.value)} min={0} step={10} /></Field>
      </div>

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <a href="/agenda" className="btn ghost">Cancelar</a>
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Agendando…' : 'Agendar e enviar WhatsApp'}
        </button>
      </div>

      <style jsx>{`
        input, select {
          width: 100%; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: white;
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
        }
        input:focus, select:focus { border-color: var(--accent); }
      `}</style>
    </form>
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
