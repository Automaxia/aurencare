'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { atualizarPerfilTributarioAction } from './actions'
import type { PerfilTributario, RegimeTributario } from '@/server/services/perfilTributario'
import { SavedBadge } from '@/components/brand/Feedback'

const REGIMES: Array<{ key: RegimeTributario; label: string; hint: string }> = [
  { key: 'autonomo_pf',        label: 'Autônomo · PF',                hint: 'Carnê-Leão + Receita Saúde (obrigatório 2026)' },
  { key: 'pj_simples_anexo3',  label: 'PJ Simples · Anexo III',       hint: 'Fator R ≥ 28% da folha · alíquota inicial 6%' },
  { key: 'pj_simples_anexo5',  label: 'PJ Simples · Anexo V',         hint: 'Sem Fator R · alíquota inicial 15,5%' },
  { key: 'pj_lucro_presumido', label: 'PJ Lucro Presumido',           hint: 'Faturamento > R$ 4,8M/ano' },
]

type Props = {
  inicial: PerfilTributario
}

export function TributarioForm({ inicial }: Props) {
  const router = useRouter()
  const [regime, setRegime]           = useState<RegimeTributario | ''>(inicial.regimeTributario ?? '')
  const [cnae, setCnae]               = useState(inicial.cnae)
  const [municipio, setMunicipio]     = useState(inicial.municipio ?? '')
  const [uf, setUf]                   = useState(inicial.municipioUf ?? '')
  const [issPct, setIssPct]           = useState(inicial.issAliquotaPct != null ? String(inicial.issAliquotaPct) : '')
  const [issRetido, setIssRetido]     = useState(inicial.issRetidoDefault)
  const [nomeContador, setNomeContador]   = useState(inicial.nomeContador ?? '')
  const [emailContador, setEmailContador] = useState(inicial.emailContador ?? '')

  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(false)
  const [erro, setErro]         = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)

  const dirty = (
    regime !== (inicial.regimeTributario ?? '') ||
    cnae !== inicial.cnae ||
    municipio !== (inicial.municipio ?? '') ||
    uf !== (inicial.municipioUf ?? '') ||
    issPct !== (inicial.issAliquotaPct != null ? String(inicial.issAliquotaPct) : '') ||
    issRetido !== inicial.issRetidoDefault ||
    nomeContador !== (inicial.nomeContador ?? '') ||
    emailContador !== (inicial.emailContador ?? '')
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setErroCampo(null); setSalvo(false)

    const issNum = issPct === '' ? null : parseFloat(issPct.replace(',', '.'))

    const r = await atualizarPerfilTributarioAction({
      regimeTributario: regime === '' ? null : regime,
      cnae: cnae.trim(),
      municipio: municipio.trim() || null,
      municipioUf: uf.trim().toUpperCase() || null,
      issAliquotaPct: issNum,
      issRetidoDefault: issRetido,
      nomeContador: nomeContador.trim() || null,
      emailContador: emailContador.trim() || null,
    })

    setSalvando(false)
    if (r.ok) {
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
      router.refresh()
    } else {
      setErro(r.error)
      setErroCampo(r.campo ?? null)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span className="sec-lbl">Tributação · Contador</span>
        {salvo && <SavedBadge />}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
        Configure o regime fiscal pra ativar cálculos corretos de impostos no Financeiro
        e gerar exportações no formato esperado pelo seu contador.
      </p>

      <Field label="Regime tributário" error={erroCampo === 'regimeTributario' ? erro : null}>
        <div style={{ display: 'grid', gap: 6 }}>
          {REGIMES.map(r => (
            <label
              key={r.key}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 8,
                background: regime === r.key ? 'rgba(106,78,200,.06)' : 'var(--card)',
                border: `1px solid ${regime === r.key ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all .15s var(--ease)',
              }}
            >
              <input
                type="radio" name="regime" checked={regime === r.key}
                onChange={() => setRegime(r.key)}
                style={{ marginTop: 3, accentColor: 'var(--accent)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <Field label="CNAE">
          <input value={cnae} onChange={e => setCnae(e.target.value)} placeholder="8650-0/03" />
        </Field>
        <Field label="Município (ISS)" error={erroCampo === 'municipio' ? erro : null}>
          <input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="São Paulo" />
        </Field>
        <Field label="UF" error={erroCampo === 'municipioUf' ? erro : null}>
          <input value={uf} onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, alignItems: 'end' }}>
        <Field
          label="Alíquota ISS (%)"
          hint="Varia 2–5% por município"
          error={erroCampo === 'issAliquotaPct' ? erro : null}
        >
          <input
            value={issPct} onChange={e => setIssPct(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder="2.0" inputMode="decimal"
          />
        </Field>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 8,
          background: 'var(--surface)',
          cursor: 'pointer', fontSize: 12, color: 'var(--ink-soft)',
        }}>
          <input
            type="checkbox" checked={issRetido}
            onChange={e => setIssRetido(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          ISS retido na fonte (default)
        </label>
      </div>

      <div className="sec-lbl" style={{ marginTop: 4 }}>Contato do contador</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <Field label="Nome">
          <input value={nomeContador} onChange={e => setNomeContador(e.target.value)} placeholder="Ex: João Silva" />
        </Field>
        <Field label="Email" error={erroCampo === 'emailContador' ? erro : null}>
          <input type="email" value={emailContador} onChange={e => setEmailContador(e.target.value)} placeholder="contador@escritorio.com" />
        </Field>
      </div>

      {erro && !erroCampo && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          className={dirty ? 'btn primary' : 'btn'}
          disabled={salvando || !dirty}
          title={!dirty ? 'Nada pra salvar' : undefined}
        >
          {salvando ? 'Salvando…' : 'Salvar tributação'}
        </button>
      </div>

      <style jsx>{`
        input {
          width: 100%; padding: 9px 12px; border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        input:not([type=radio]):not([type=checkbox]):hover { border-color: var(--field-border-hover); }
        input:not([type=radio]):not([type=checkbox]):focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        input:not([type=radio]):not([type=checkbox]):user-invalid { border-color: var(--rose); }
        input:not([type=radio]):not([type=checkbox]):user-invalid:focus { box-shadow: var(--field-ring-error); }
        input[type=radio], input[type=checkbox] { width: auto; padding: 0; }
      `}</style>
    </form>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{
        fontSize: 11, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.06em',
      }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}
