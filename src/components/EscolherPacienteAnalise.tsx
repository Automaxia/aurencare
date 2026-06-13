'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Landing das telas de análise clínica (Objetivos / Temas / Evolução) quando
 * acessadas direto pela sidebar, sem um paciente no contexto. Em vez de pular
 * pro "paciente mais relevante" (comportamento antigo, que confundia), mostra
 * uma página base pra escolher QUEM analisar.
 */

type Item = { id: string; nome: string; meta: string }

type Props = {
  pacientes: Item[]
  segment: 'objetivos' | 'temas' | 'evolucao'
  titulo: string
  icone: string
  descricao: string
}

export function EscolherPacienteAnalise({ pacientes, segment, titulo, icone, descricao }: Props) {
  const [q, setQ] = useState('')
  const filtrados = pacientes.filter(p => !q || p.nome.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0 }}>
          <span style={{ color: 'var(--accent)', marginRight: 8 }}>{icone}</span>{titulo}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>{descricao}</p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 560 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar paciente…"
            style={{ width: '100%', border: 0, outline: 'none', fontSize: 14, padding: '4px 0', background: 'transparent', color: 'var(--ink)' }}
          />
        </div>
        <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              {pacientes.length === 0 ? 'Nenhum paciente ativo ainda.' : 'Nenhum paciente encontrado.'}
            </div>
          ) : (
            filtrados.map(p => (
              <Link
                key={p.id}
                href={`/pacientes/${p.id}/${segment}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 14px', textDecoration: 'none', color: 'inherit',
                  borderTop: '1px solid var(--border)',
                }}
                className="escolher-pac-item"
              >
                <div className="pts-av" style={{ width: 30, height: 30, fontSize: 11 }}>{iniciais(p.nome)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.meta}</div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--faint)' }}>→</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}
