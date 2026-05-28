import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { obterPerfil } from '@/server/services/psicologo'
import { redirect } from 'next/navigation'
import { PerfilForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const user = await requirePsicologo()
  const perfil = await obterPerfil(user.id)
  if (!perfil) redirect('/')

  return (
    <div>
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
        }}
        emailAtual={perfil.email}
        waConectado={perfil.waConectado}
      />
    </div>
  )
}
