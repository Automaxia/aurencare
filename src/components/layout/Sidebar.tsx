'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react'
import { Logo, LogoMark } from '../brand/Logo'
import { NAV, activeHref, type Mundo } from '@/lib/nav'
import { useSidebar } from './AppShell'

const CLINICO = NAV.filter(n => n.mundo === 'clinico' && n.sidebar)
const PRATICA = NAV.filter(n => n.mundo === 'pratica' && n.sidebar)

export function Sidebar() {
  const pathname = usePathname() ?? '/'
  const active = activeHref(pathname)
  const { collapsed, toggle, isNarrow } = useSidebar()
  const { data: session } = useSession()

  // Hover-to-peek: ao recolhida (em telas largas), passar o mouse abre temporariamente
  // como OVERLAY — sem empurrar o conteúdo. O clique no logo/seta fixa de vez.
  const [peek, setPeek] = useState(false)
  const podePeek = collapsed && !isNarrow
  const exibePeek = peek && podePeek
  const efetivo = collapsed && !exibePeek   // colapsado "efetivo" pro render

  return (
    <aside
      className="sidebar"
      data-peek={exibePeek ? 'true' : 'false'}
      onMouseEnter={() => podePeek && setPeek(true)}
      onMouseLeave={() => setPeek(false)}
    >
      <button
        className="sb-tog"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        title={collapsed ? 'Expandir' : 'Recolher'}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      <div className="sb-logo">
        {efetivo ? (
          <button className="sb-logo-btn" onClick={toggle} title="Expandir menu" aria-label="Expandir menu">
            <LogoMark size={28} />
          </button>
        ) : <Logo size={28} tagline="Continuidade Terapêutica" />}
      </div>

      <nav className="sb-nav">
        <Group label="Mundo Clínico" items={CLINICO} active={active} mundo="clinico" collapsed={efetivo} />
        <Group label="Mundo Prática" items={PRATICA} active={active} mundo="pratica" collapsed={efetivo} />
        {(session?.user as any)?.role === 'admin' && (
          <div className="sb-group">
            {!efetivo && <div className="sb-label">Gestão</div>}
            <Link
              href="/admin"
              className="sb-item"
              data-world="pratica"
              data-active={pathname.startsWith('/admin') ? 'true' : 'false'}
              title="Administração"
            >
              <span className="sb-icon" aria-hidden="true">⚙</span>
              {!efetivo && <span className="sb-lbl">Administração</span>}
            </Link>
          </div>
        )}
      </nav>

      <div className="sb-bot">
        <UserCard
          collapsed={efetivo}
          name={session?.user?.name ?? 'Usuária'}
          crp={(session?.user as any)?.crp ?? ''}
        />
      </div>
    </aside>
  )
}

function Group({
  label, items, active, mundo, collapsed,
}: {
  label: string; items: typeof NAV; active: string; mundo: Mundo; collapsed: boolean
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
          {!collapsed && <span className="sb-lbl">{item.label}</span>}
        </Link>
      ))}
    </div>
  )
}

function UserCard({ collapsed, name, crp }: { collapsed: boolean; name: string; crp: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClickOut(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [open])

  // Layout colapsado: só avatar com dropdown.
  if (collapsed) {
    return (
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="sb-user"
          onClick={() => setOpen(o => !o)}
          title={`${name} — abrir menu`}
        >
          <span className="u-av">{iniciais(name)}</span>
        </button>
        {open && (
          <UserMenu onClose={() => setOpen(false)} />
        )}
      </div>
    )
  }

  // Layout expandido: card do usuário (vai pra /perfil) + botão Sair visível.
  return (
    <div ref={wrapRef} className="sb-user-wrap">
      <Link
        href="/perfil"
        className="sb-user"
        title="Editar perfil"
        style={{ flex: 1, minWidth: 0 }}
      >
        <span className="u-av">{iniciais(name)}</span>
        <span className="u-meta">
          <span className="u-name">{name}</span>
          {crp && <span className="u-crp">{crp}</span>}
        </span>
      </Link>
      <button
        type="button"
        className="sb-logout"
        onClick={() => signOut({ callbackUrl: '/login' })}
        title="Sair"
        aria-label="Sair"
      >
        <LogOut size={15} />
      </button>
    </div>
  )
}

function UserMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="sb-user-menu" role="menu">
      <Link
        href="/perfil"
        className="sb-user-menu-item"
        role="menuitem"
        onClick={onClose}
        style={{ textDecoration: 'none' }}
      >
        <User size={14} />
        <span>Perfil</span>
      </Link>
      <button
        type="button"
        className="sb-user-menu-item"
        onClick={() => signOut({ callbackUrl: '/login' })}
        role="menuitem"
      >
        <LogOut size={14} />
        <span>Sair</span>
      </button>
    </div>
  )
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + (p[p.length - 1][0] ?? '')).toUpperCase()
}
