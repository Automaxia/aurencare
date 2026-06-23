import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { listarPacientes } from '@/server/services/pacientes'
import { temPacienteDemo } from '@/server/services/pacienteDemo'
import { formatTimeBR, formatDateBR } from '@/lib/formatters'
import { PacientesFilter, type OrdenacaoKey, type VisualizacaoKey } from './filter'
import { PatientCard, type PatientCardData } from './PatientCard'
import { PatientRow } from './PatientRow'
import { DemoControl } from './DemoControl'

export const dynamic = 'force-dynamic'

type FilterKey = 'todos' | 'hoje' | 'atencao' | 'novos' | 'arquivados'

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
  // "Assinar →" leva à REVISÃO da sessão não assinada (onde se assina), não à
  // tela de dados do paciente. Só mostra se há de fato uma sessão pra assinar.
  if (p.badge?.label === 'Registrar' && p.sessaoRegistroId)
    return { label: 'Assinar →', href: `/sessao/${p.sessaoRegistroId}` }
  if (p.proximaSessao?.id)             return { label: 'Sessão →', href: `/sessao/${p.proximaSessao.id}` }
  return { label: '+ Sessão', href: `/agenda/nova` }
}

const ORDENACOES_VALIDAS: OrdenacaoKey[] = ['proxima', 'nome', 'recente']
const VIS_VALIDAS: VisualizacaoKey[] = ['grid', 'lista']

export default async function PacientesPage({ searchParams }: { searchParams: { filtro?: FilterKey; busca?: string; ord?: string; vis?: string } }) {
  const user = await requirePsicologo()
  const filtro = (searchParams?.filtro ?? 'todos') as FilterKey
  const busca = (searchParams?.busca ?? '').toLowerCase().trim()
  const ordenacao = (ORDENACOES_VALIDAS.includes(searchParams?.ord as OrdenacaoKey)
    ? searchParams!.ord
    : 'proxima') as OrdenacaoKey
  const visualizacao = (VIS_VALIDAS.includes(searchParams?.vis as VisualizacaoKey)
    ? searchParams!.vis
    : 'grid') as VisualizacaoKey

  const apenasArquivados = filtro === 'arquivados'
  const [all, totalArquivados, demoId] = await Promise.all([
    listarPacientes(user.id, { apenasArquivados }),
    db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pacientes WHERE psicologo_id = $1 AND status = 'inativo'`,
      [user.id],
    ).then(r => r.rows[0]?.n ?? 0),
    temPacienteDemo(user.id),
  ])
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

  // Ordenação
  filtered.sort((a, b) => {
    if (ordenacao === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    if (ordenacao === 'recente') return +new Date(b.createdAt) - +new Date(a.createdAt)
    // 'proxima': próxima sessão crescente; quem não tem vai pro fim
    const ai = a.proximaSessao?.dataHora ? +new Date(a.proximaSessao.dataHora) : Infinity
    const bi = b.proximaSessao?.dataHora ? +new Date(b.proximaSessao.dataHora) : Infinity
    if (ai !== bi) return ai - bi
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  })

  const counts = {
    todos:      apenasArquivados ? 0 : all.length,
    hoje:       apenasArquivados ? 0 : all.filter(p => isToday(p.proximaSessao?.dataHora)).length,
    atencao:    apenasArquivados ? 0 : all.filter(p => ['Atenção','Registrar','Espaçando'].includes(p.badge?.label ?? '')).length,
    novos:      apenasArquivados ? 0 : all.filter(p => p.badge?.label === 'Nova').length,
    arquivados: totalArquivados,
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
      demo: p.id === demoId,
    }
  })

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${all.length} ${all.length === 1 ? 'paciente' : 'pacientes'}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DemoControl demoId={demoId} />
            <Link className="btn primary" href="/pacientes/novo">+ Novo paciente</Link>
          </div>
        }
      />

      <PacientesFilter
        active={filtro}
        counts={counts}
        busca={busca}
        ordenacao={ordenacao}
        visualizacao={visualizacao}
      />

      {cards.length === 0 ? (
        <EmptyState>
          {all.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <span>Você ainda não tem pacientes. Comece adicionando um — ou crie a Maria Joana para explorar o produto.</span>
              {!demoId && <DemoControl demoId={demoId} variant="empty" />}
            </div>
          ) : 'Nenhum paciente bate com esse filtro.'}
        </EmptyState>
      ) : visualizacao === 'lista' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {cards.map(c => <PatientRow key={c.id} p={c} />)}
        </div>
      ) : (
        <div className="ptc-grid">
          {cards.map(c => <PatientCard key={c.id} p={c} />)}
        </div>
      )}
    </div>
  )
}
