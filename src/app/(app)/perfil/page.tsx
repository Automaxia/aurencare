import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { obterPerfil } from '@/server/services/psicologo'
import { redirect } from 'next/navigation'
import { PerfilForm } from './form'
import { integrationStatus } from '@/server/lib/env'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const user = await requirePsicologo()
  const perfil = await obterPerfil(user.id)
  if (!perfil) redirect('/')

  return (
    <div>
      <PageHeader
        title="Perfil profissional"
        subtitle="Seus dados de cadastro, valor da sessão e integrações."
      />
      <PerfilForm
        initial={{
          nome: perfil.nome,
          crp: perfil.crp,
          email: perfil.email,
          valorSessao: perfil.valorSessao,
          waInstancia: perfil.waInstancia,
        }}
        emailAtual={perfil.email}
        integrationStatus={{
          anthropic: integrationStatus.anthropic,
          evolution: integrationStatus.evolution,
          pagarme:   integrationStatus.pagarme,
          assembly:  integrationStatus.assembly,
        }}
      />
    </div>
  )
}
