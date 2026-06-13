import { requirePsicologo } from '@/server/lib/auth'
import { pacientesParaSelecao } from '@/server/services/pacientes'
import { EscolherPacienteAnalise } from '@/components/EscolherPacienteAnalise'

export const dynamic = 'force-dynamic'

export default async function ObjetivosEscolher() {
  const user = await requirePsicologo()
  const pacientes = await pacientesParaSelecao(user.id)
  return (
    <EscolherPacienteAnalise
      pacientes={pacientes}
      segment="objetivos"
      titulo="Objetivos e Progresso"
      icone="◬"
      descricao="Escolha um paciente para ver e gerir os objetivos terapêuticos."
    />
  )
}
