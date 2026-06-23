/**
 * Trilha de navegação (breadcrumb) derivada do pathname.
 * Cada crumb tem um label; os intermediários têm href (clicáveis para voltar),
 * o último é o atual (sem href). Fonte única usada pela Topbar.
 */

export type Crumb = { label: string; href?: string }

/** Rótulos de rotas conhecidas (chave = href exato). */
const LABELS: Record<string, string> = {
  '/pacientes':            'Pacientes',
  '/agenda':               'Agenda',
  '/agenda/nova':          'Nova sessão',
  '/financeiro':           'Financeiro',
  '/financeiro/contabil':  'Contábil',
  '/saude':                'Saúde da Prática',
  '/objetivos':            'Objetivos e Progresso',
  '/temas':                'Temas Recorrentes',
  '/evolucao':             'Evolução Registrada',
  '/planos':               'Planos',
  '/perfil':               'Minha conta',
  '/perfil/recebimentos':  'Recebimentos',
}

/** Subpáginas dentro de um paciente. */
const PAC_SUB: Record<string, string> = {
  objetivos: 'Objetivos e Progresso',
  temas:     'Temas Recorrentes',
  evolucao:  'Evolução Registrada',
}

export function buildBreadcrumb(pathname: string, ctx?: { pacienteNome?: string | null }): Crumb[] {
  const p = (pathname || '/').replace(/\/+$/, '') || '/'
  const home: Crumb = { label: 'Início', href: '/' }

  if (p === '/' || p === '') return [{ label: 'Início' }]

  // Paciente: perfil + subpáginas (objetivos/temas/evolução)
  const mPac = p.match(/^\/pacientes\/([^/]+)(?:\/(objetivos|temas|evolucao))?$/)
  if (mPac && mPac[1] !== 'novo') {
    const [, id, sub] = mPac
    const nome = ctx?.pacienteNome?.trim() || 'Paciente'
    const trail: Crumb[] = [home, { label: 'Pacientes', href: '/pacientes' }]
    if (sub) {
      trail.push({ label: nome, href: `/pacientes/${id}` })
      trail.push({ label: PAC_SUB[sub] })
    } else {
      trail.push({ label: nome })
    }
    return trail
  }
  if (p === '/pacientes/novo') {
    return [home, { label: 'Pacientes', href: '/pacientes' }, { label: 'Novo paciente' }]
  }

  // Genérico: caminha pelos prefixos conhecidos, do raso ao profundo.
  const segs = p.split('/').filter(Boolean)
  const trail: Crumb[] = [home]
  let acc = ''
  for (const s of segs) {
    acc += '/' + s
    const label = LABELS[acc]
    if (label) trail.push({ label, href: acc })
  }
  if (trail.length === 1) trail.push({ label: 'Audere' }) // rota desconhecida
  delete trail[trail.length - 1].href                     // último = atual
  return trail
}
