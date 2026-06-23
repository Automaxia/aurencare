'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { atualizarChavePixAction } from './actions'
import type { TipoChavePix } from '@/server/services/onboardingPagamento'

type Props = {
  chaveAtual: { tipo: TipoChavePix; valorMasc: string } | null
}

const TIPOS_PIX: Array<{ key: TipoChavePix; label: string; placeholder: string }> = [
  { key: 'cpf',       label: 'CPF',       placeholder: '000.000.000-00' },
  { key: 'cnpj',      label: 'CNPJ',      placeholder: '00.000.000/0000-00' },
  { key: 'email',     label: 'Email',     placeholder: 'voce@email.com' },
  { key: 'celular',   label: 'Celular',   placeholder: '(11) 98765-4321' },
  { key: 'aleatoria', label: 'Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export function ChavePixForm({ chaveAtual }: Props) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState<TipoChavePix>(chaveAtual?.tipo ?? 'cpf')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setErroCampo(null); setSalvando(true)
    const r = await atualizarChavePixAction({ tipo, valor: valor.trim() })
    setSalvando(false)
    if (r.ok) {
      setSalvo(true)
      setEditando(false)
      setValor('')
      setTimeout(() => setSalvo(false), 3000)
      router.refresh()
    } else {
      setErro(r.error); setErroCampo(r.campo ?? null)
    }
  }

  async function remover() {
    if (!confirm('Remover a chave PIX cadastrada?')) return
    setSalvando(true); setErro(null)
    const r = await atualizarChavePixAction(null)
    setSalvando(false)
    if (r.ok) { router.refresh() } else { setErro(r.error) }
  }

  // Sem chave + não editando = card de empty state
  if (!chaveAtual && !editando) {
    return (
      <div className="card">
        <div className="sec-lbl" style={{ marginBottom: 12 }}>Chave PIX preferida</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
          Sem chave PIX cadastrada. Adicione uma pra ficar disponível em estornos a pacientes
          e propagação futura ao Pagar.me.
        </p>
        <button type="button" className="btn primary" onClick={() => setEditando(true)}>
          + Cadastrar chave PIX
        </button>
      </div>
    )
  }

  // Tem chave + não editando = mostra mascarada
  if (chaveAtual && !editando) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span className="sec-lbl">Chave PIX preferida</span>
          {salvo && <span style={{ color: 'var(--sage)', fontSize: 12 }}>✓ Atualizada</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
          <ReadField label="Tipo" value={tipoLabel(chaveAtual.tipo)} />
          <ReadField label="Chave" value={chaveAtual.valorMasc} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={() => setEditando(true)}>Alterar</button>
          <button type="button" className="btn ghost sm" onClick={remover} disabled={salvando} style={{ color: 'var(--rose)' }}>
            Remover
          </button>
        </div>
      </div>
    )
  }

  // Modo edição
  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="sec-lbl">{chaveAtual ? 'Alterar chave PIX' : 'Cadastrar chave PIX'}</span>
        <button type="button" className="btn ghost sm" onClick={() => { setEditando(false); setValor(''); setErro(null) }}>Cancelar</button>
      </div>

      <Field label="Tipo de chave" error={erroCampo === 'chavePixTipo' ? erro : null}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIPOS_PIX.map(t => (
            <button
              key={t.key} type="button"
              onClick={() => { setTipo(t.key); setValor('') }}
              style={pillStyle(tipo === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Chave PIX" error={erroCampo === 'chavePixValor' ? erro : null}>
        <input
          required value={valor} onChange={e => setValor(e.target.value)}
          placeholder={TIPOS_PIX.find(t => t.key === tipo)?.placeholder}
          inputMode={tipo === 'email' ? 'email' : tipo === 'aleatoria' ? 'text' : 'numeric'}
          autoComplete="off"
        />
      </Field>

      {erro && !erroCampo && (
        <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn primary" disabled={salvando || !valor.trim()}>
          {salvando ? 'Salvando…' : 'Salvar chave PIX'}
        </button>
      </div>

      <style jsx>{`
        input {
          width: 100%; padding: 9px 12px; border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        input:hover { border-color: var(--field-border-hover); }
        input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        input:user-invalid { border-color: var(--rose); }
        input:user-invalid:focus { box-shadow: var(--field-ring-error); }
      `}</style>
    </form>
  )
}

function tipoLabel(t: TipoChavePix): string {
  return ({ cpf: 'CPF', cnpj: 'CNPJ', email: 'Email', celular: 'Celular', aleatoria: 'Aleatória' } as Record<TipoChavePix, string>)[t]
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 999,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'rgba(106,78,200,.10)' : 'transparent',
    color: active ? '#391d96' : 'var(--muted)',
    fontWeight: active ? 500 : 400, fontFamily: 'inherit', fontSize: 12,
    cursor: 'pointer', transition: 'all .15s var(--ease)',
  }
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono), monospace' }}>{value}</div>
    </div>
  )
}
