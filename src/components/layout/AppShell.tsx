'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Ctx = {
  collapsed: boolean           // estado resolvido (visual)
  toggle: () => void
  setCollapsed: (v: boolean) => void
  isNarrow: boolean            // viewport < BREAKPOINT
}
const SidebarCtx = createContext<Ctx | null>(null)
const STORAGE_KEY = 'auren.sidebar.collapsed'
const BREAKPOINT = 1024

export function AppShell({ children }: { children: React.ReactNode }) {
  const [userPref, setUserPref] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restaura preferência + escuta resize.
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === '1') setUserPref(true)
    } catch { /* */ }

    const check = () => setIsNarrow(window.innerWidth < BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    setHydrated(true)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Estado VISÍVEL = preferência OU forçado por viewport estreita.
  const collapsed = userPref || isNarrow

  function setCollapsed(v: boolean) {
    setUserPref(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* */ }
  }

  // No viewport estreito, toggle ainda funciona mas só desligando a preferência (o resize force ainda recolhe).
  function toggle() {
    setCollapsed(!collapsed)
  }

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle, setCollapsed, isNarrow }}>
      <div className="app-shell" data-collapsed={collapsed ? 'true' : 'false'} suppressHydrationWarning>
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
