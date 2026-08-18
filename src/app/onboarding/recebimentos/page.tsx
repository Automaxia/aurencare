import { requirePsicologo } from '@/server/lib/auth'
import { lerStatusOnboarding, lerRascunhoOnboarding } from '@/server/services/onboardingPagamento'
import { redirect } from 'next/navigation'
import { Wizard } from './wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingRecebimentosPage() {
  const user = await requirePsicologo()
  const status = await lerStatusOnboarding(user.id)
  if (status.completo) redirect('/')

  // Tentativa anterior que a Pagar.me recusou deixa os dados salvos — repovoa
  // o formulário em vez de fazer a pessoa redigitar os três passos.
  const rascunho = await lerRascunhoOnboarding(user.id)

  return <Wizard nomePsicologa={user.name ?? ''} inicial={rascunho} />
}
