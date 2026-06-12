import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { listarConversasWa } from '@/server/services/conversasWa'
import { ConversasView } from './ConversasView'

export const dynamic = 'force-dynamic'

export default async function ConversasPage() {
  const user = await requirePsicologo()
  const conversas = await listarConversasWa(user.id)
  const naoLidas = conversas.reduce((a, c) => a + (c.naoLidas > 0 ? 1 : 0), 0)

  return (
    <div>
      <PageHeader
        title="Conversas"
        subtitle={naoLidas > 0 ? `${naoLidas} conversa${naoLidas > 1 ? 's' : ''} com mensagens novas` : 'Mensagens do WhatsApp dos seus pacientes'}
      />
      <ConversasView inicial={conversas} />
    </div>
  )
}
