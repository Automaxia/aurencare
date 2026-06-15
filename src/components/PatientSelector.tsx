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
  /** null = barra "em branco" (landing de seleção pela sidebar, sem paciente no contexto). */
  current: Paciente | null
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
    // Wrapper relativo: o dropdown ancora na barra (mesma largura), como um
    // <select>, em vez de um modal centralizado. marginBottom fica no wrapper
    // (a barra zera o seu) pra o top:100% bater exatamente na base da barra.
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div className="pt-selector" style={{ marginBottom: 0 }}>
        <div className="pts-cur" onClick={() => setOpen(o => !o)}>
          <div className="pts-av" style={current ? undefined : { background: 'var(--surface)', color: 'var(--muted)' }}>
            {current ? initials(current.nome) : '+'}
          </div>
          <div>
            <div className="pts-name" style={current ? undefined : { color: 'var(--muted)' }}>
              {current ? current.nome : 'Selecionar paciente'}
            </div>
            <div className="pts-meta">{current?.meta ?? 'Escolha quem analisar'}</div>
          </div>
        </div>
        <div className="pts-chg" onClick={() => setOpen(o => !o)}>{current ? 'Trocar ↕' : 'Selecionar ↕'}</div>
      </div>

      {open && (
        <>
          {/* Captura clique-fora pra fechar (transparente, abaixo do painel). */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
          <div
            className="card"
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
              maxHeight: '60vh', padding: 0, overflow: 'hidden',
              boxShadow: '0 14px 34px rgba(20,16,38,.20)',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar paciente…"
                style={{ width: '100%', border: 0, outline: 'none', fontSize: 14, padding: '4px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(60vh - 52px)' }}>
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
                    background: p.id === current?.id ? 'var(--accent-lo)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (p.id !== current?.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onMouseLeave={e => { if (p.id !== current?.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="pts-av" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(p.nome)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{p.nome}</div>
                    {p.meta && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.meta}</div>}
                  </div>
                  {p.id === current?.id && <span style={{ fontSize: 11, color: 'var(--accent)' }}>atual</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}
