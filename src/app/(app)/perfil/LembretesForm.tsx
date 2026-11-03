'use client'

import { useState } from 'react'
import { salvarLembretesPadraoAction } from './actions'
import { SavedBadge } from '@/components/brand/Feedback'
import { ROTULO_LEMBRETE } from '@/components/lembretes/rotulos'
import type { LembretesPadrao, TipoLembrete } from '@/server/services/lembretes'

const TIPOS: TipoLembrete[] = ['lembrete24h', 'lembrete2h', 'lembrete15min']

/** Padrão de lembretes do psicólogo. Cada paciente pode ter o seu ajuste na ficha. */
export function LembretesForm({ initial }: { initial: LembretesPadrao }) {
  const [v, setV] = useState<LembretesPadrao>(initial)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function salvar() {
    setLoading(true); setError(null); setSaved(false)
    try {
      const r = await salvarLembretesPadraoAction(v)
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setError('Falha ao salvar.')
    } catch {
      setError('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 720, marginTop: 18 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Lembretes ao paciente
        </div>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>
          Padrão para todos os pacientes. Na ficha de cada um dá para ajustar, combinando com ele.
        </div>
      </div>

      {TIPOS.map(t => (
        <label key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={v[t]}
            onChange={e => setV(prev => ({ ...prev, [t]: e.target.checked }))}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{ROTULO_LEMBRETE[t].titulo}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)' }}>{ROTULO_LEMBRETE[t].detalhe}</span>
          </span>
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
