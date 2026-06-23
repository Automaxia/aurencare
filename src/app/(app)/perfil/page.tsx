import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { obterPerfil } from '@/server/services/psicologo'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PerfilForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const user = await requirePsicologo()
  const perfil = await obterPerfil(user.id)
  if (!perfil) redirect('/')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        <TabLink href="/perfil"              label="Perfil"       active />
        <TabLink href="/perfil/recebimentos" label="Recebimentos" active={false} />
        <TabLink href="/planos"              label="Plano e uso"  active={false} />
      </div>
      <PageHeader
        title="Perfil profissional"
        subtitle="Seus dados básicos e valor da sessão."
      />
      <PerfilForm
        initial={{
          nome: perfil.nome,
          crp: perfil.crp,
          email: perfil.email,
          telefone: perfil.telefone ?? '',
          valorSessao: perfil.valorSessao,
          genero: perfil.genero,
        }}
        emailAtual={perfil.email}
        waConectado={perfil.waConectado}
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
