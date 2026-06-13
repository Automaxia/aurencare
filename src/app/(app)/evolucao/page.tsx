import { requirePsicologo } from '@/server/lib/auth'
import { pacientesParaSelecao } from '@/server/services/pacientes'
import { EscolherPacienteAnalise } from '@/components/EscolherPacienteAnalise'

export const dynamic = 'force-dynamic'

export default async function EvolucaoEscolher() {
  const user = await requirePsicologo()
  const pacientes = await pacientesParaSelecao(user.id)
  return (
    <EscolherPacienteAnalise
      pacientes={pacientes}
      segment="evolucao"
      titulo="Evolução Registrada"
      icone="◫"
      descricao="Escolha um paciente para acompanhar a evolução ao longo das sessões."
    />
  )
}
