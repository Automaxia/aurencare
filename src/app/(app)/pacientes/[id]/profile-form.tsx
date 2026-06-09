'use client'

import { useMemo, useState } from 'react'
import { salvarCondicoesAction } from './actions'
import { CidAutocomplete } from '@/components/CidAutocomplete'

type Condicoes = { cid?: string[]; medicacoes?: { nome: string; dose?: string }[]; alertas?: string[]; observacoes?: string }

export function PatientProfileForm({ pacienteId, initial }: { pacienteId: string; initial: Condicoes | null }) {
  // Valores iniciais serializados em string — base pra comparação
  const initialCids    = initial?.cid ?? []
  const initialCidKey  = initialCids.join('|')
  const initialMeds    = (initial?.medicacoes ?? []).map(m => `${m.nome}${m.dose ? ' (' + m.dose + ')' : ''}`).join('\n')
  const initialAlertas = (initial?.alertas ?? []).join('\n')
  const initialObs     = initial?.observacoes ?? ''

  const [cids, setCids]               = useState<string[]>(initialCids)
  const [medsText, setMedsText]       = useState(initialMeds)
  const [alertasText, setAlertasText] = useState(initialAlertas)
  const [obs, setObs]                 = useState(initialObs)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Habilita Salvar só quando algum campo mudou em relação ao inicial.
  const dirty = useMemo(
    () =>
      cids.join('|')  !== initialCidKey ||
      medsText    !== initialMeds ||
      alertasText !== initialAlertas ||
      obs         !== initialObs,
    [cids, medsText, alertasText, obs, initialCidKey, initialMeds, initialAlertas, initialObs],
  )

  async function salvar() {
    setLoading(true); setError(null); setSaved(false)
    try {
      const condicoes: Condicoes = {
        cid: cids,
        medicacoes: medsText.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const m = line.match(/^(.+?)\s*\((.+?)\)\s*$/)
          return m ? { nome: m[1].trim(), dose: m[2].trim() } : { nome: line }
        }),
        alertas: alertasText.split('\n').map(s => s.trim()).filter(Boolean),
        observacoes: obs.trim() || undefined,
      }
      const r = await salvarCondicoesAction(pacienteId, condicoes)
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
      else setError('Falha ao salvar.')
    } catch {
      setError('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Condições clínicas</div>

      <Field label="CID-10 (busque por código ou condição)">
        <CidAutocomplete value={cids} onChange={setCids} />
      </Field>

      <Field label="Medicações (uma por linha — 'nome (dose)')">
        <textarea value={medsText} onChange={e => setMedsText(e.target.value)} rows={3} placeholder={'Sertralina (50mg)\nClonazepam (0.5mg s/n)'} />
      </Field>

      <Field label="Alertas (um por linha — exibidos em destaque na sessão)">
        <textarea value={alertasText} onChange={e => setAlertasText(e.target.value)} rows={2} placeholder={'Histórico de ideação\nAlergia a benzodiazepínicos'} />
      </Field>

      <Field label="Observações livres">
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder="Contexto familiar, antecedentes, qualquer informação que ajude na continuidade…" />
      </Field>

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
      {saved && <div style={{ color: 'var(--sage)', fontSize: 12 }}>✓ Salvo</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>
          {dirty ? 'Você tem alterações não salvas' : 'Nenhuma alteração pendente'}
        </span>
        <button
          className={dirty ? 'btn primary' : 'btn'}
          onClick={salvar}
          disabled={loading || !dirty}
          title={!dirty ? 'Nada para salvar' : undefined}
        >
          {loading ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <style jsx>{`
        input, textarea {
          width: 100%; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: white;
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
        }
        input:focus, textarea:focus { border-color: var(--accent); }
        textarea { resize: vertical; }
      `}</style>
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
