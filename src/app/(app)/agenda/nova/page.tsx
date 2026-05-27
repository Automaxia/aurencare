import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarPacientes } from '@/server/services/pacientes'
import { NewSessionForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NovaSessaoPage() {
  const user = await requirePsicologo()
  const pacientes = await listarPacientes(user.id)
  const elegiveis = pacientes.filter(p => p.consentimentoAceito)

  if (elegiveis.length === 0) {
    return (
      <div>
        <PageHeader title="Nova sessão" subtitle="Paciente · data/hora · modalidade." />
        <EmptyState>
          Você ainda não tem pacientes com consentimento aceito. Cadastre um e aguarde o aceite via WhatsApp.
        </EmptyState>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Nova sessão"
        subtitle="O WhatsApp do paciente vai receber a pergunta de método de pagamento ao salvar."
      />
      <NewSessionForm pacientes={elegiveis.map(p => ({ id: p.id, nome: p.nome }))} />
    </div>
  )
}
