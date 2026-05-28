import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarPacientes } from '@/server/services/pacientes'
import { formatTimeBR, formatDateBR } from '@/lib/formatters'
import { PacientesFilter } from './filter'
import { PatientCard, type PatientCardData } from './PatientCard'

export const dynamic = 'force-dynamic'

type FilterKey = 'todos' | 'hoje' | 'atencao' | 'novos'

const AV_GRADIENTS = [
  'linear-gradient(135deg, #6b4fcf, #a080f8)',
  'linear-gradient(135deg, #2060a0, #60a0e0)',
  'linear-gradient(135deg, #c04080, #f090b0)',
  'linear-gradient(135deg, #4a8a6e, #6fcfa9)',
  'linear-gradient(135deg, #8c6f3a, #d6b86b)',
  'linear-gradient(135deg, #6e5f9c, #b09cd9)',
]

function avatarFor(id: string, nome: string): { initials: string; bg: string } {
  const parts = nome.trim().split(/\s+/)
  const initials = (parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return { initials, bg: AV_GRADIENTS[hash % AV_GRADIENTS.length] }
}

function frequenciaTag(diasMedio: number | null): { texto: string; klass: 'ok' | 'warn' | 'mute' } {
  if (diasMedio === null) return { texto: '—', klass: 'mute' }
  if (diasMedio <= 9)  return { texto: 'Semanal ✓', klass: 'ok' }
  if (diasMedio <= 17) return { texto: 'Quinzenal', klass: 'ok' }
  if (diasMedio <= 35) return { texto: 'Mensal', klass: 'mute' }
  return { texto: 'Espaçando', klass: 'warn' }
}

function formatProxima(iso: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  const hoje = new Date()
  if (dt.toDateString() === hoje.toDateString()) return `Hoje · ${formatTimeBR(iso)}`
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1)
  if (dt.toDateString() === amanha.toDateString()) return `Amanhã · ${formatTimeBR(iso)}`
  return `${formatDateBR(iso)} · ${formatTimeBR(iso)}`
}

function formatDesde(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}

function badgeTagClass(label: string): 'info' | 'ok' | 'warn' | 'alert' | 'mute' {
  if (label === 'Atenção') return 'alert'
  if (label === 'Espaçando' || label === 'Registrar') return 'warn'
  if (label === 'Nova') return 'info'
  return 'mute'
}

function pickPrincipalCta(p: any): { label: string; href: string } {
  if (p.badge?.label === 'Registrar') return { label: 'Assinar →', href: `/pacientes/${p.id}` }
  if (p.proximaSessao?.id)             return { label: 'Sessão →', href: `/sessao/${p.proximaSessao.id}` }
  return { label: '+ Sessão', href: `/agenda/nova` }
}

export default async function PacientesPage({ searchParams }: { searchParams: { filtro?: FilterKey; busca?: string } }) {
  const user = await requirePsicologo()
  const filtro = (searchParams?.filtro ?? 'todos') as FilterKey
  const busca = (searchParams?.busca ?? '').toLowerCase().trim()

  const all = await listarPacientes(user.id)
  const hojeStr = new Date().toDateString()

  const isToday = (iso: string | null | undefined) =>
    !!iso && new Date(iso).toDateString() === hojeStr

  const filtered = all.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca) && !p.telefone.includes(busca)) return false
    if (filtro === 'hoje')    return isToday(p.proximaSessao?.dataHora)
    if (filtro === 'atencao') return ['Atenção', 'Registrar', 'Espaçando'].includes(p.badge?.label ?? '')
    if (filtro === 'novos')   return p.badge?.label === 'Nova'
    return true
  })

  const counts = {
    todos:   all.length,
    hoje:    all.filter(p => isToday(p.proximaSessao?.dataHora)).length,
    atencao: all.filter(p => ['Atenção','Registrar','Espaçando'].includes(p.badge?.label ?? '')).length,
    novos:   all.filter(p => p.badge?.label === 'Nova').length,
  }

  // Calcula intervalo médio de sessões por paciente para frequência
  function intervaloMedio(p: any): number | null {
    if (!p.ultimaSessaoEm || !p.proximaSessao) return null
    const diff = +new Date(p.proximaSessao.dataHora) - +new Date(p.ultimaSessaoEm)
    return Math.round(diff / 86_400_000)
  }

  const cards: PatientCardData[] = filtered.map(p => {
    const av = avatarFor(p.id, p.nome)
    const freq = frequenciaTag(intervaloMedio(p))
    return {
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      consentimentoAceito: p.consentimentoAceito,
      badgeLabel: p.badge?.label ?? null,
      badgeKlass: p.badge ? badgeTagClass(p.badge.label) : null,
      proximaSessao: p.proximaSessao
        ? { id: p.proximaSessao.id ?? '', dataHora: p.proximaSessao.dataHora }
        : null,
      proximaTexto: formatProxima(p.proximaSessao?.dataHora ?? null),
      proximaHoje: isToday(p.proximaSessao?.dataHora),
      freqLabel: freq.texto,
      freqKlass: freq.klass,
      desdeMes: formatDesde(p.createdAt),
      sessoesTotais: p.sessoesTotais,
      avInitials: av.initials,
      avBg: av.bg,
      principalCta: pickPrincipalCta(p),
    }
  })

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${all.length} ${all.length === 1 ? 'paciente' : 'pacientes'}`}
        actions={<Link className="btn primary" href="/pacientes/novo">+ Novo paciente</Link>}
      />

      <PacientesFilter active={filtro} counts={counts} busca={busca} />

      {cards.length === 0 ? (
        <EmptyState>
          {all.length === 0
            ? 'Você ainda não tem pacientes. Comece adicionando um.'
            : 'Nenhum paciente bate com esse filtro.'}
        </EmptyState>
      ) : (
        <div className="ptc-grid">
          {cards.map(c => <PatientCard key={c.id} p={c} />)}
        </div>
      )}
    </div>
  )
}
