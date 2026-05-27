'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Pt-selector recorrente em Grafo / Evolução / Objetivos.
 * Mostra avatar circular com iniciais + nome + meta resumida + botão Trocar.
 * Ao clicar Trocar, abre dropdown com busca + lista de pacientes elegíveis.
 *
 * Mockup v12.5 §page-grafo / §page-longitudinal / §page-continuidade.
 */

type Paciente = {
  id: string
  nome: string
  meta?: string  // "7 sessões · março 2025 · semanal · online"
}

type Props = {
  current: Paciente
  basePath: '/pacientes' // sempre — formato /pacientes/[id]/temas|evolucao|objetivos
  segment: 'temas' | 'evolucao' | 'objetivos'
}

export function PatientSelector({ current, basePath, segment }: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [list, setList] = useState<Paciente[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || list) return
    setLoading(true)
    fetch('/api/pacientes')
      .then(r => r.ok ? r.json() : [])
      .then((items: any[]) => setList(items.map(p => ({
        id: p.id, nome: p.nome,
        meta: p.sessoesTotais ? `${p.sessoesTotais} sessão${p.sessoesTotais > 1 ? 'ões' : ''}` : 'sem sessões',
      }))))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [open, list])

  const filtered = (list ?? []).filter(p => !q || p.nome.toLowerCase().includes(q.toLowerCase()))

  function pick(p: Paciente) {
    setOpen(false); setQ('')
    router.push(`${basePath}/${p.id}/${segment}`)
  }

  return (
    <>
      <div className="pt-selector">
        <div className="pts-cur" onClick={() => setOpen(true)}>
          <div className="pts-av">{initials(current.nome)}</div>
          <div>
            <div className="pts-name">{current.nome}</div>
            {current.meta && <div className="pts-meta">{current.meta}</div>}
          </div>
        </div>
        <div className="pts-chg" onClick={() => setOpen(true)}>Trocar ↕</div>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,38,.45)', zIndex: 60, display: 'grid', placeItems: 'flex-start center', paddingTop: 80, backdropFilter: 'blur(4px)' }}
        >
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 460, maxHeight: '70vh', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar paciente…"
                style={{ width: '100%', border: 0, outline: 'none', fontSize: 14, padding: '4px 0' }}
              />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '55vh' }}>
              {loading && <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Carregando…</div>}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>Nenhum paciente.</div>
              )}
              {filtered.map(p => (
                <div
                  key={p.id} onClick={() => pick(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    background: p.id === current.id ? 'var(--accent-lo)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (p.id !== current.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onMouseLeave={e => { if (p.id !== current.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="pts-av" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(p.nome)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{p.nome}</div>
                    {p.meta && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.meta}</div>}
                  </div>
                  {p.id === current.id && <span style={{ fontSize: 11, color: 'var(--accent)' }}>atual</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}
