'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Logo, LogoMark } from '../brand/Logo'
import { NAV, activeHref, type Mundo } from '@/lib/nav'

const CLINICO = NAV.filter(n => n.mundo === 'clinico' && n.sidebar)
const PRATICA = NAV.filter(n => n.mundo === 'pratica' && n.sidebar)

export function Sidebar() {
  const pathname = usePathname() ?? '/'
  const active = activeHref(pathname)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className="sidebar" data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="sb-logo">
        {collapsed ? <LogoMark size={28} /> : <Logo size={28} />}
      </div>

      <Group label="Mundo Clínico" items={CLINICO} active={active} mundo="clinico" collapsed={collapsed} />
      <Group label="Mundo Prática" items={PRATICA} active={active} mundo="pratica" collapsed={collapsed} />

      <button className="sb-toggle" onClick={() => setCollapsed(c => !c)} aria-label="Alternar sidebar">
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  )
}

function Group({
  label,
  items,
  active,
  mundo,
  collapsed,
}: {
  label: string
  items: typeof NAV
  active: string
  mundo: Mundo
  collapsed: boolean
}) {
  return (
    <div className="sb-group">
      {!collapsed && <div className="sb-label">{label}</div>}
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className="sb-item"
          data-world={mundo}
          data-active={active === item.href ? 'true' : 'false'}
          title={item.label}
        >
          <span className="sb-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
