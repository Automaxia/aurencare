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
 * Grid arrastável dos widgets do Modo Presença. Persiste ordem em localStorage.
 * Cada children precisa ter prop `key` = id do widget.
 */

const STORAGE_KEY = 'auren.sess.widgets.order'

type Props = {
  defaultOrder: string[]
  children: React.ReactElement[]
}

export function SortableGrid({ defaultOrder, children }: Props) {
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [hydrated, setHydrated] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (Array.isArray(saved) && saved.length === defaultOrder.length && saved.every(s => typeof s === 'string')) {
        // garante que todos os IDs default ainda existem
        const allPresent = defaultOrder.every(id => saved.includes(id))
        if (allPresent) setOrder(saved)
      }
    } catch { /* */ }
    setHydrated(true)
  }, [defaultOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id))
  }
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

  // Mapeia children por key
  const map = new Map<string, React.ReactElement>()
  children.forEach(child => {
    const k = String((child.key ?? '').toString())
    if (k) map.set(k, child)
  })

  // Antes da hidratação, render em ordem default (evita mismatch)
  const used = hydrated ? order : defaultOrder

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext items={used} strategy={rectSortingStrategy}>
        {used.map(id => {
          const child = map.get(id)
          if (!child) return null
          return <SortableItem key={id} id={id} isDragging={activeId === id}>{child}</SortableItem>
        })}
      </SortableContext>
    </DndContext>
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
