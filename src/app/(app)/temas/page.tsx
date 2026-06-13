import { requirePsicologo } from '@/server/lib/auth'
import { pacientesParaSelecao } from '@/server/services/pacientes'
import { EscolherPacienteAnalise } from '@/components/EscolherPacienteAnalise'

export const dynamic = 'force-dynamic'

export default async function TemasEscolher() {
  const user = await requirePsicologo()
  const pacientes = await pacientesParaSelecao(user.id)
  return (
    <EscolherPacienteAnalise
      pacientes={pacientes}
      segment="temas"
      titulo="Temas Recorrentes"
      icone="◍"
      descricao="Escolha um paciente para explorar o mapa de temas das sessões."
    />
  )
}
