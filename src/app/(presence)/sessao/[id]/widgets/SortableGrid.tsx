'use client'

import { useEffect, useState } from 'react'

/**
 * Painel de widgets do Modo Presença.
 *
 * Layout: masonry via CSS multi-column (no `.sess-right`) — empacota cada coluna
 * sem buracos verticais, preservando a ordem de prioridade.
 *
 * Hierarquia: a ORDEM da lista é a prioridade. Ao LIGAR um painel ele vai pro
 * topo (aparece primeiro); ao desligar, vai pro fim. Tudo persiste em localStorage.
 *
 * Visibilidade: menu "Personalizar" liga/desliga por painel, aplica na hora,
 * sem botão Salvar nem confirmação (padrão de dashboards configuráveis).
 */

const STORAGE_KEY = 'auren.sess.widgets.order'
const STORAGE_KEY_HIDDEN = 'auren.sess.widgets.hidden'

type Props = {
  defaultOrder: string[]
  /** id do widget → nome legível, pro menu Personalizar. */
  labels: Record<string, string>
  children: React.ReactElement[]
}

export function SortableGrid({ defaultOrder, labels, children }: Props) {
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (Array.isArray(saved) && saved.length === defaultOrder.length && saved.every(s => typeof s === 'string')) {
        if (defaultOrder.every(id => saved.includes(id))) setOrder(saved)
      }
    } catch { /* */ }
    try {
      const savedHidden = JSON.parse(localStorage.getItem(STORAGE_KEY_HIDDEN) || 'null')
      if (Array.isArray(savedHidden)) {
        setHidden(new Set(savedHidden.filter((s: any) => typeof s === 'string' && defaultOrder.includes(s))))
      }
    } catch { /* */ }
    setHydrated(true)
  }, [defaultOrder])

  function persistOrder(next: string[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* */ } }
  function persistHidden(next: Set<string>) { try { localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify([...next])) } catch { /* */ } }

  // Liga/desliga 1 painel. Ao LIGAR, o painel entra no FIM da prioridade — assim
  // o que você liga PRIMEIRO fica em cima e os próximos entram abaixo (ordem de
  // clique = ordem na tela). Desligar só oculta, sem mexer na posição.
  function toggle(id: string) {
    const ligando = hidden.has(id)
    const nextHidden = new Set(hidden)
    if (ligando) nextHidden.delete(id); else nextHidden.add(id)
    setHidden(nextHidden); persistHidden(nextHidden)
    if (ligando) {
      const next = [...order.filter(x => x !== id), id]
      setOrder(next); persistOrder(next)
    }
  }
  // Reordena manualmente (setas ↑/↓ no menu): troca com o vizinho na ordem.
  function mover(id: string, dir: -1 | 1) {
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next); persistOrder(next)
  }
  function mostrarTodos() { const vazio = new Set<string>(); setHidden(vazio); persistHidden(vazio) }
  function ocultarTodos() { const todos = new Set(defaultOrder); setHidden(todos); persistHidden(todos) }
  function restaurarPadrao() {
    setHidden(new Set()); persistHidden(new Set())
    setOrder(defaultOrder); persistOrder(defaultOrder)
    setMenuOpen(false)
  }

  // Mapeia children por key
  const map = new Map<string, React.ReactElement>()
  children.forEach(child => {
    const k = String((child.key ?? '').toString())
    if (k) map.set(k, child)
  })

  const used = hydrated ? order : defaultOrder
  const visiveis = used.filter(id => !hidden.has(id))
  const ativos = defaultOrder.filter(id => !hidden.has(id)).length

  const bulkBtn: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 999,
    border: '1px solid var(--accent)', color: 'var(--accent)', background: 'var(--card)', cursor: 'pointer',
  }

  return (
    <>
      {/* Barra de personalização — bloco normal acima do masonry. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-haspopup="true" aria-expanded={menuOpen}
          title="Escolher quais painéis aparecem na sessão"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 500,
            color: menuOpen ? 'white' : 'var(--accent)', border: '1px solid var(--accent)',
            background: menuOpen ? 'var(--accent)' : 'var(--accent-lo)',
            boxShadow: '0 1px 3px rgba(106,78,200,.18)',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>⚙</span> Personalizar painéis
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
            <div className="card" role="menu" aria-label="Painéis na sessão" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
              width: 290, padding: 0, overflow: 'hidden', boxShadow: '0 14px 34px rgba(20,16,38,.20)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Painéis na sessão</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={mostrarTodos} style={bulkBtn}>Mostrar todos</button>
                  <button type="button" onClick={ocultarTodos} style={bulkBtn}>Ocultar todos</button>
                </div>
              </div>
              <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '4px 0' }}>
                {order.map((id, i) => {
                  const on = !hidden.has(id)
                  return (
                    <div
                      key={id}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 14px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <button
                        type="button" role="menuitemcheckbox" aria-checked={on}
                        onClick={() => toggle(id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 0, background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 13, color: on ? 'var(--ink)' : 'var(--muted)' }}
                      >
                        <Switch on={on} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labels[id] ?? id}</span>
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <ArrowBtn dir="up" disabled={i === 0} onClick={() => mover(id, -1)} />
                        <ArrowBtn dir="down" disabled={i === order.length - 1} onClick={() => mover(id, 1)} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ativos} de {defaultOrder.length} ativos</span>
                <button type="button" onClick={restaurarPadrao} className="btn ghost sm" style={{ fontSize: 12 }}>Restaurar padrão</button>
              </div>
            </div>
          </>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Nenhum painel ativo. Escolha o que mostrar em <strong>⚙ Personalizar painéis</strong>.
        </div>
      ) : (
        <div className="sess-masonry">
          {visiveis.map(id => map.get(id) ?? null)}
        </div>
      )}
    </>
  )
}

/** Seta de reordenar (↑/↓) no menu Personalizar. */
function ArrowBtn({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === 'up' ? 'Subir (mais prioridade)' : 'Descer (menos prioridade)'}
      style={{
        width: 22, height: 16, display: 'grid', placeItems: 'center', padding: 0,
        border: '1px solid var(--border)', borderRadius: 5, background: 'var(--card)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        color: 'var(--muted)', fontSize: 9, lineHeight: 1,
      }}
    >
      {dir === 'up' ? '▲' : '▼'}
    </button>
  )
}

/** Switch on/off minimalista (o estado real é o aria-checked do botão pai). */
function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{
      width: 32, height: 18, borderRadius: 999, flexShrink: 0, position: 'relative',
      background: on ? 'var(--accent)' : 'var(--faint)', transition: 'background .15s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%',
        background: 'white', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
      }} />
    </span>
  )
}
