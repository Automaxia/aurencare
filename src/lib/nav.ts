/**
 * Mapa de navegação canônico — espelha CLAUDE.md §5.
 * Centralizado para que Sidebar, Topbar (pill de contexto) e o middleware
 * compartilhem a mesma fonte de verdade sobre "mundos" e rotas.
 */

export type Mundo = 'clinico' | 'pratica'

export type NavItem = {
  href: string
  label: string
  icon: string // glyph compacto conforme §5
  mundo: Mundo
  /**
   * Rotas com placeholder dinâmico não aparecem na sidebar superior
   * (são acessadas a partir de telas de paciente).
   */
  sidebar?: boolean
}

export const NAV: NavItem[] = [
  // ── Mundo Clínico ──
  { href: '/',           label: 'Início',                  icon: '◈', mundo: 'clinico', sidebar: true },
  { href: '/pacientes',  label: 'Pacientes',               icon: '◉', mundo: 'clinico', sidebar: true },
  { href: '/objetivos',  label: 'Objetivos e Progresso',   icon: '◬', mundo: 'clinico', sidebar: true },
  { href: '/temas',      label: 'Temas Recorrentes',       icon: '◍', mundo: 'clinico', sidebar: true },
  { href: '/evolucao',   label: 'Evolução Registrada',     icon: '◫', mundo: 'clinico', sidebar: true },

  // ── Mundo Prática ──
  { href: '/financeiro', label: 'Financeiro',         icon: '◑', mundo: 'pratica', sidebar: true },
  { href: '/agenda',     label: 'Agenda',             icon: '◷', mundo: 'pratica', sidebar: true },
  { href: '/conversas',  label: 'Conversas',          icon: '◐', mundo: 'pratica', sidebar: true },
  { href: '/saude',      label: 'Saúde da Prática',   icon: '◬', mundo: 'pratica', sidebar: true },
]

/**
 * Decide o mundo da rota atual.
 * Rotas /pacientes/[id]/* permanecem no mundo clínico.
 */
export function mundoFromPath(pathname: string): Mundo {
  if (
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/saude')
  ) return 'pratica'
  return 'clinico'
}

export function activeHref(pathname: string): string {
  // Match exato.
  const exact = NAV.find(n => n.href === pathname)
  if (exact) return exact.href
  // /pacientes/[id]/objetivos → /objetivos (ativo no sidebar)
  if (pathname.match(/^\/pacientes\/[^/]+\/objetivos/)) return '/objetivos'
  if (pathname.match(/^\/pacientes\/[^/]+\/temas/))     return '/temas'
  if (pathname.match(/^\/pacientes\/[^/]+\/evolucao/))  return '/evolucao'
  // Fallback prefix.
  const prefix = NAV
    .filter(n => n.href !== '/' && pathname.startsWith(n.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return prefix?.href ?? '/'
}
