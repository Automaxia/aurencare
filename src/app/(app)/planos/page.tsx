import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { obterAssinatura } from '@/server/services/assinatura'
import { PLANOS, BETA_LIBERADO } from '@/server/lib/planos'
import { integrationStatus } from '@/server/lib/env'
import Link from 'next/link'
import { PlanosForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PlanosPage({ searchParams }: {
  searchParams?: { plano?: string; ciclo?: string }
}) {
  const user = await requirePsicologo()
  const info = await obterAssinatura(user.id)

  // Intenção vinda da vitrine pública. Validada aqui — o que chega da URL é
  // palpite do usuário, não dado: plano desconhecido simplesmente não pré-seleciona.
  const planoUrl = searchParams?.plano
  const pre = planoUrl === 'essencial' || planoUrl === 'pro'
    ? { plano: planoUrl as 'essencial' | 'pro', ciclo: (searchParams?.ciclo === 'anual' ? 'anual' : 'mensal') as 'mensal' | 'anual' }
    : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        <TabLink href="/perfil"              label="Perfil"       active={false} />
        <TabLink href="/perfil/recebimentos" label="Recebimentos" active={false} />
        <TabLink href="/planos"              label="Plano e uso"  active />
      </div>

      <PageHeader
        title="Plano e uso"
        subtitle="Seu plano e o consumo de sessões com IA do mês."
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
          cortesiaAte: info.cortesiaAte,
        }}
        mock={!integrationStatus.pagarme}
        beta={BETA_LIBERADO}
        pre={pre}
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
