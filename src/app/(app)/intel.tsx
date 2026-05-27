'use client'

import { useState } from 'react'
import { CfpBadge } from '@/components/brand/CfpBadge'

/**
 * Nível 3 do dashboard — Inteligência silenciosa.
 * Bloco expandível "↓ Observações". §6.
 */
export function IntelSection({ pacientesEspacando, novos }: { pacientesEspacando: number; novos: number }) {
  const [open, setOpen] = useState(false)

  const observacoes: string[] = []
  if (pacientesEspacando > 0) observacoes.push(
    `Observa-se ${pacientesEspacando} paciente${pacientesEspacando > 1 ? 's' : ''} sem sessão há mais de 14 dias — possível tendência de espaçamento.`,
  )
  if (novos > 0) observacoes.push(
    `${novos} paciente${novos > 1 ? 's' : ''} com menos de 4 sessões — fase inicial de vínculo.`,
  )
  if (observacoes.length === 0) observacoes.push('Sem observações silenciosas nesta semana.')

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn ghost"
        style={{ padding: '8px 0', fontSize: 13, color: 'var(--muted)' }}
      >
        {open ? '↑' : '↓'} Observações
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {observacoes.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
          <div style={{ marginTop: 12 }}><CfpBadge /></div>
        </div>
      )}
    </section>
  )
}
