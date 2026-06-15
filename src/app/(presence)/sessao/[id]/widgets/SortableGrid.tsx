'use client'

import { useEffect, useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandleContext } from '@/components/WidgetGrip'

/**
 * Grid arrastável dos widgets do Modo Presença.
 * - Ordem persistida em localStorage (arraste pelo grip).
 * - Visibilidade por painel via menu "Personalizar": liga/desliga, aplica na
 *   hora e persiste — sem botão Salvar, sem confirmação (padrão de dashboards
 *   configuráveis; é reversível pelo mesmo menu).
 * Cada children precisa ter prop `key` = id do widget.
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
  const [activeId, setActiveId] = useState<string | null>(null)
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart(ev: DragStartEvent) { setActiveId(String(ev.active.id)) }
  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null)
    const { active, over } = ev
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const oldIdx = prev.indexOf(String(active.id))
      const newIdx = prev.indexOf(String(over.id))
      if (oldIdx === -1 || newIdx === -1) return prev
      const next = arrayMove(prev, oldIdx, newIdx)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* */ }
      return next
    })
  }

  function persistHidden(next: Set<string>) {
    try { localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify([...next])) } catch { /* */ }
  }
  function toggle(id: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      persistHidden(next)
      return next
    })
  }
  function restaurarPadrao() {
    setHidden(new Set()); persistHidden(new Set())
    setOrder(defaultOrder)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
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

  return (
    <>
      {/* Barra de personalização — ocupa a linha inteira do grid (1 / -1). */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', position: 'relative', marginBottom: 2 }}>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setMenuOpen(o => !o)}
          aria-haspopup="true" aria-expanded={menuOpen}
          title="Escolher quais painéis aparecem na sessão"
        >
          ⚙ Personalizar painéis
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
            <div className="card" role="menu" aria-label="Painéis na sessão" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
              width: 280, padding: 0, overflow: 'hidden', boxShadow: '0 14px 34px rgba(20,16,38,.20)',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
                Painéis na sessão
              </div>
              <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '4px 0' }}>
                {defaultOrder.map(id => {
                  const on = !hidden.has(id)
                  return (
                    <button
                      key={id} type="button" role="menuitemcheckbox" aria-checked={on}
                      onClick={() => toggle(id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: '9px 14px', textAlign: 'left', fontSize: 13, color: 'var(--ink)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Switch on={on} />
                      <span style={{ flex: 1 }}>{labels[id] ?? id}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ativos} de {defaultOrder.length} ativos</span>
                <button type="button" onClick={restaurarPadrao} className="btn ghost sm" style={{ fontSize: 12 }}>
                  Restaurar padrão
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="card" style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Nenhum painel ativo. Escolha o que mostrar em <strong>⚙ Personalizar painéis</strong>.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={visiveis} strategy={rectSortingStrategy}>
            {visiveis.map(id => {
              const child = map.get(id)
              if (!child) return null
              return <SortableItem key={id} id={id} isDragging={activeId === id}>{child}</SortableItem>
            })}
          </SortableContext>
        </DndContext>
      )}
    </>
  )
}

/** Switch on/off minimalista (visual; o estado real é o aria-checked do botão pai). */
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

function SortableItem({ id, children, isDragging }: { id: string; children: React.ReactElement; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging: sortDragging } = useSortable({ id })
  // Detecta se é wide via classList no children (passa direto pra wrapper div)
  const childClass = (children.props.className as string) || ''
  const isWide = childClass.includes('wide')

  // Os listeners do drag NÃO vão no wrapper inteiro — vão só no grip (via context).
  // Assim o widget só move pelo grip e a barra de espaço funciona nos textareas.
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: isWide ? '1 / -1' : undefined,
        opacity: sortDragging || isDragging ? .5 : 1,
        zIndex: sortDragging ? 10 : undefined,
      }}
    >
      <DragHandleContext.Provider value={{ attributes, listeners, setRef: setActivatorNodeRef }}>
        {children}
      </DragHandleContext.Provider>
    </div>
  )
}
