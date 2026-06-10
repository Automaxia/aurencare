'use client'

import { createContext, useCallback, useContext, useState } from 'react'

/**
 * Toast leve, sem dependência. Fica montado no layout do app, então um toast
 * disparado antes de um router.push() persiste após a navegação (confirmação
 * de "criado" aparece na página de destino).
 */

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; msg: string; kind: ToastKind }
type Ctx = { toast: (msg: string, kind?: ToastKind) => void }

const ToastCtx = createContext<Ctx>({ toast: () => {} })
export function useToast() { return useContext(ToastCtx) }

let _seq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = ++_seq
    setItems(l => [...l, { id, msg, kind }])
    setTimeout(() => setItems(l => l.filter(t => t.id !== id)), 3600)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap" role="region" aria-live="polite" aria-label="Notificações">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            <span className="toast-ico" aria-hidden="true">{t.kind === 'error' ? '!' : '✓'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
