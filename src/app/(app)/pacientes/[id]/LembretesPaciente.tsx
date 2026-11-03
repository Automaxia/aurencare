'use client'

import { useState } from 'react'
import Link from 'next/link'
import { salvarLembretesPacienteAction } from './actions'
import { SavedBadge } from '@/components/brand/Feedback'
import { ROTULO_LEMBRETE } from '@/components/lembretes/rotulos'
import type { LembretesPaciente as Prefs, LembretesPadrao, TipoLembrete } from '@/server/services/lembretes'

const TIPOS: TipoLembrete[] = ['lembrete24h', 'lembrete2h', 'lembrete15min']

/** Ajuste por paciente: "padrão" (null) segue o que está no perfil do psicólogo. */
export function LembretesPaciente({ pacienteId, initial, padrao }: {
  pacienteId: string; initial: Prefs; padrao: LembretesPadrao
}) {
  const [v, setV] = useState<Prefs>(initial)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function salvar() {
    setLoading(true); setError(null); setSaved(false)
    try {
      const r = await salvarLembretesPacienteAction(pacienteId, v)
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setError('Falha ao salvar.')
    } catch {
      setError('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const valorSelect = (x: boolean | null) => (x === null ? 'padrao' : x ? 'sim' : 'nao')

  return (
    <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <div style={{ fontSize: 12, color: 'var(--faint)' }}>
        Combine com o paciente. “Padrão” segue o que está no seu <Link href="/perfil">perfil</Link>.
      </div>

      {TIPOS.map(t => (
        <label key={t} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{ROTULO_LEMBRETE[t].titulo}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)' }}>{ROTULO_LEMBRETE[t].detalhe}</span>
          </span>
          <select
            value={valorSelect(v[t])}
            onChange={e => {
              const x = e.target.value
              setV(prev => ({ ...prev, [t]: x === 'padrao' ? null : x === 'sim' }))
            }}
            style={{
              padding: '7px 10px', borderRadius: 'var(--field-radius)', border: '1px solid var(--field-border)',
              background: 'var(--field-bg)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
            }}
          >
            <option value="padrao">Padrão ({padrao[t] ? 'ligado' : 'desligado'})</option>
            <option value="sim">Ligado</option>
            <option value="nao">Desligado</option>
          </select>
        </label>
      ))}

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
      {saved && <SavedBadge />}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={salvar} disabled={loading}>
          {loading ? 'Salvando…' : 'Salvar lembretes'}
        </button>
      </div>
    </div>
  )
}
