'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Ctx = { collapsed: boolean; toggle: () => void; setCollapsed: (v: boolean) => void }
const SidebarCtx = createContext<Ctx | null>(null)
const STORAGE_KEY = 'auren.sidebar.collapsed'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // restaura preferência após mount (evita hydration mismatch)
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === '1') setCollapsed(true)
    } catch { /* */ }
    setHydrated(true)
  }, [])

  function persist(v: boolean) {
    setCollapsed(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* */ }
  }

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle: () => persist(!collapsed), setCollapsed: persist }}>
      <div className="app-shell" data-collapsed={collapsed ? 'true' : 'false'} suppressHydrationWarning>
        {/* sem flicker: no SSR sempre é "false"; após hidratar, se preferência for true, anima pra colapsado */}
        {children}
      </div>
    </SidebarCtx.Provider>
  )
}

export function useSidebar(): Ctx {
  const ctx = useContext(SidebarCtx)
  if (!ctx) throw new Error('useSidebar fora de <AppShell>')
  return ctx
}
