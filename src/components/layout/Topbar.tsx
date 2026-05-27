'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { mundoFromPath } from '@/lib/nav'

/**
 * Topbar com pill de contexto (muda de cor por mundo) e slot para
 * sessão ativa pulsante. §6.
 */
export function Topbar({ activeSession }: { activeSession?: { id: string; nome: string } | null }) {
  const pathname = usePathname() ?? '/'
  const mundo = mundoFromPath(pathname)
  const label = mundo === 'clinico' ? 'Mundo clínico' : 'Mundo prática'

  return (
    <header className="topbar">
      <span className="ctx-pill" data-world={mundo}>
        <span className="ctx-dot" />
        {label}
      </span>

      {activeSession && (
        <Link href={`/sessao/${activeSession.id}`} className="sess-pill">
          <span className="rp-dot animate-pulse" />
          <span>{activeSession.nome} · em andamento</span>
        </Link>
      )}
    </header>
  )
}
