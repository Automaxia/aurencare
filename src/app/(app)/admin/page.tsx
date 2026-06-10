import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { obterCockpit, listarUsuariosAdmin } from '@/server/services/admin'
import { AdminCockpit } from './AdminCockpit'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await requireRole('admin')
  const [kpis, usuarios] = await Promise.all([obterCockpit(), listarUsuariosAdmin()])

  const cards: { label: string; valor: number | string; cor?: string }[] = [
    { label: 'Usuários', valor: kpis.usuarios },
    { label: 'Ativos', valor: kpis.ativos, cor: 'var(--sage)' },
    { label: 'Suspensos', valor: kpis.suspensos, cor: kpis.suspensos > 0 ? 'var(--rose)' : undefined },
    { label: 'Novos (30d)', valor: kpis.novos30 },
    { label: 'Pacientes ativos', valor: kpis.pacientes },
    { label: 'Sessões', valor: kpis.sessoes },
    { label: 'Pagantes', valor: kpis.pagantes, cor: 'var(--accent)' },
  ]

  return (
    <div>
      <PageHeader title="Administração" subtitle="Cockpit de gestão da plataforma" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, color: c.cor ?? 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>
              {c.valor}
            </div>
          </div>
        ))}
      </div>

      <AdminCockpit usuarios={usuarios} adminId={admin.id} />
    </div>
  )
}
