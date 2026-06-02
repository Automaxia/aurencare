import { requirePsicologo } from '@/server/lib/auth'
import { lerStatusOnboarding } from '@/server/services/onboardingPagamento'
import { redirect } from 'next/navigation'
import { Wizard } from './wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingRecebimentosPage() {
  const user = await requirePsicologo()
  const status = await lerStatusOnboarding(user.id)
  if (status.completo) redirect('/')

  return <Wizard nomePsicologa={user.name ?? ''} />
}
