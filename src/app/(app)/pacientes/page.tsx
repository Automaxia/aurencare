import Link from 'next/link'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarPacientes } from '@/server/services/pacientes'
import { formatPhone, formatRelativeDays } from '@/lib/formatters'
import { PacientesFilter } from './filter'

export const dynamic = 'force-dynamic'

type FilterKey = 'todos' | 'ativos' | 'atencao' | 'espacando' | 'novos'

export default async function PacientesPage({ searchParams }: { searchParams: { filtro?: FilterKey; busca?: string } }) {
  const user = await requirePsicologo()
  const filtro = (searchParams?.filtro ?? 'todos') as FilterKey
  const busca = (searchParams?.busca ?? '').toLowerCase().trim()

  const all = await listarPacientes(user.id)

  const filtered = all.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca) && !p.telefone.includes(busca)) return false
    if (filtro === 'ativos')    return p.status === 'ativo'
    if (filtro === 'atencao')   return p.badge?.label === 'Atenção'
    if (filtro === 'espacando') return p.badge?.label === 'Espaçando'
    if (filtro === 'novos')     return p.badge?.label === 'Nova'
    return true
  })

  const counts = {
    todos: all.length,
    ativos: all.filter(p => p.status === 'ativo').length,
    atencao: all.filter(p => p.badge?.label === 'Atenção').length,
    espacando: all.filter(p => p.badge?.label === 'Espaçando').length,
    novos: all.filter(p => p.badge?.label === 'Nova').length,
  }

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Quem você está acompanhando agora."
        actions={<Link className="btn primary" href="/pacientes/novo">+ Novo paciente</Link>}
      />

      <PacientesFilter active={filtro} counts={counts} busca={busca} />

      {filtered.length === 0 ? (
        <EmptyState>
          {all.length === 0
            ? 'Você ainda não tem pacientes. Comece adicionando um.'
            : 'Nenhum paciente bate com esse filtro.'}
        </EmptyState>
      ) : (
        <ul style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
          {filtered.map(p => (
            <li key={p.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.nome}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                  {formatPhone(p.telefone)}{p.email ? ` · ${p.email}` : ''}
                </div>
                {!p.consentimentoAceito && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)' }}>
                    ⏳ Aguardando consentimento
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                {p.sessoesTotais > 0
                  ? `${p.sessoesTotais} sessão${p.sessoesTotais > 1 ? 'ões' : ''}`
                  : 'Sem sessões'}
                {p.ultimaSessaoEm && <div>última: {formatRelativeDays(p.ultimaSessaoEm)}</div>}
              </div>
              <div>{p.badge && <span className={`badge ${p.badge.color}`}>{p.badge.label}</span>}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
