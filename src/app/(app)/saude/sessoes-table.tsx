'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatDateTimeBR } from '@/lib/formatters'

export type SessaoRow = {
  id: string
  numero: number
  dataHora: string
  pacienteNome: string
  status: string
  modalidade: string
  duracaoMin: number
  valor: number
  assinada: boolean
}

const STATUS_FILTROS = [
  { key: 'todos',     label: 'Todas' },
  { key: 'concluida', label: 'Concluídas' },
  { key: 'no_show',   label: 'Sem comparecimento' },
  { key: 'cancelada', label: 'Canceladas' },
  { key: 'agendada',  label: 'Próximas' },
] as const

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada',
  aguardando_metodo: 'Aguard. método',
  aguardando_pagamento: 'Aguard. pagamento',
  confirmada: 'Confirmada',
  em_curso: 'Em curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  no_show: 'Sem comparecimento',
}
const STATUS_TAG: Record<string, 'ok' | 'warn' | 'mute' | 'alert' | 'info'> = {
  concluida: 'ok',
  agendada: 'mute',
  aguardando_metodo: 'warn',
  aguardando_pagamento: 'warn',
  confirmada: 'ok',
  em_curso: 'info',
  cancelada: 'alert',
  no_show: 'alert',
}

export function SessoesTable({ sessoes }: { sessoes: SessaoRow[] }) {
  const [filtro, setFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState<string>('')

  // Conta status agrupando "Próximas" (agendada + confirmada + aguardando_*)
  function matchFiltro(s: SessaoRow, key: string): boolean {
    if (key === 'todos') return true
    if (key === 'agendada') {
      return ['agendada', 'confirmada', 'aguardando_metodo', 'aguardando_pagamento'].includes(s.status)
    }
    return s.status === key
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: sessoes.length }
    for (const f of STATUS_FILTROS) if (f.key !== 'todos') c[f.key] = sessoes.filter(s => matchFiltro(s, f.key)).length
    return c
  }, [sessoes])

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return sessoes.filter(s => {
      if (!matchFiltro(s, filtro)) return false
      if (q && !s.pacienteNome.toLowerCase().includes(q)) return false
      return true
    })
  }, [sessoes, filtro, busca])

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="ftabs">
          {STATUS_FILTROS.map(f => (
            <button key={f.key} type="button" className={`ftab${filtro === f.key ? ' active' : ''}`} onClick={() => setFiltro(f.key)}>
              {f.label}
              {counts[f.key] > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>{counts[f.key]}</span>}
            </button>
          ))}
        </div>
        <div className="search-box" style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 13, color: 'var(--faint)' }}>⌕</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente…" />
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="empty">
          {sessoes.length === 0 ? 'Sem sessões nos últimos 90 dias.' : 'Nenhuma sessão bate com esses filtros.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {filtradas.length} {filtradas.length === 1 ? 'sessão' : 'sessões'}
              {filtradas.length !== sessoes.length && ` de ${sessoes.length}`}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', textAlign: 'left' }}>
                <Th>Data</Th><Th>#</Th><Th>Paciente</Th><Th>Modalidade</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>{formatDateTimeBR(s.dataHora)}</Td>
                  <Td><span style={{ color: 'var(--muted)' }}>#{s.numero}</span></Td>
                  <Td>
                    <Link href={`/sessao/${s.id}`} style={{ color: 'var(--ink-soft)' }}>{s.pacienteNome}</Link>
                  </Td>
                  <Td><span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.modalidade}</span></Td>
                  <Td>
                    <span className={`tag t-${STATUS_TAG[s.status] ?? 'mute'}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    {s.status === 'concluida' && !s.assinada && (
                      <span className="tag t-warn" style={{ marginLeft: 6, fontSize: 10 }}>registrar</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 14px' }}>{children}</td>
}
