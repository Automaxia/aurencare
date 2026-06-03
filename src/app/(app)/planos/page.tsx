import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { obterAssinatura } from '@/server/services/assinatura'
import { PLANOS } from '@/server/lib/planos'
import { integrationStatus } from '@/server/lib/env'
import Link from 'next/link'
import { PlanosForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PlanosPage() {
  const user = await requirePsicologo()
  const info = await obterAssinatura(user.id)

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        <TabLink href="/perfil"              label="Perfil"       active={false} />
        <TabLink href="/perfil/recebimentos" label="Recebimentos" active={false} />
        <TabLink href="/planos"              label="Plano e uso"  active />
      </div>

      <PageHeader
        title="Plano e uso"
        subtitle="Sua mensalidade e o consumo de sessões com IA do mês."
      />

      <PlanosForm
        planos={PLANOS}
        atual={{
          plano: info.plano,
          status: info.status,
          ciclo: info.ciclo,
          expiraEm: info.expiraEm,
          cap: info.cap,
          usadas: info.usadas,
          restantes: info.restantes,
        }}
        mock={!integrationStatus.pagarme}
      />
    </div>
  )
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 12,
        background: active ? 'rgba(106,78,200,.10)' : 'transparent',
        color: active ? '#391d96' : 'var(--muted)',
        fontWeight: active ? 500 : 400,
        textDecoration: 'none', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'all .15s var(--ease)',
      }}
    >
      {label}
    </Link>
  )
}
