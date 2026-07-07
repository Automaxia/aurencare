'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sigilo } from '@/components/Sigilo'

type Pac = { id: string; nome: string }

/**
 * Nível 3 do dashboard — Inteligência silenciosa.
 * Bloco expandível "↓ Observações". §6. Observações factuais da agenda (sem IA),
 * nomeando e linkando o paciente em questão.
 */
export function IntelSection({ espacando, novos }: { espacando: Pac[]; novos: Pac[] }) {
  const [open, setOpen] = useState(false)
  const vazio = espacando.length === 0 && novos.length === 0

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn ghost"
        style={{ padding: '8px 0', fontSize: 13, color: 'var(--muted)' }}
      >
        {open ? '↑' : '↓'} Observações
        {!vazio && <span style={{ marginLeft: 6, color: 'var(--amber)' }}>· {espacando.length + novos.length}</span>}
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8, display: 'grid', gap: 12 }}>
          {vazio && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sem observações silenciosas nesta semana.</div>
          )}

          {espacando.length > 0 && (
            <Bloco titulo="Sem sessão há mais de 14 dias — possível espaçamento" pacientes={espacando} cor="var(--amber)" />
          )}
          {novos.length > 0 && (
            <Bloco titulo="Menos de 4 sessões — fase inicial de vínculo" pacientes={novos} cor="var(--accent)" />
          )}

          <div style={{ fontSize: 11, color: 'var(--faint)' }}>
            Apoio à reflexão · observações factuais a partir da sua agenda (sem IA).
          </div>
        </div>
      )}
    </section>
  )
}

function Bloco({ titulo, pacientes, cor }: { titulo: string; pacientes: Pac[]; cor: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8, lineHeight: 1.4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
        {titulo}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pacientes.map(p => (
          <Link key={p.id} href={`/pacientes/${p.id}`} className="pip" style={{ fontSize: 12.5 }}>
            <Sigilo>{p.nome}</Sigilo> →
          </Link>
        ))}
      </div>
    </div>
  )
}
