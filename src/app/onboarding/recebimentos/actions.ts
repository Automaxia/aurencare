'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { salvarOnboarding, type OnboardingInput, type SalvarResult } from '@/server/services/onboardingPagamento'

export async function salvarOnboardingAction(input: OnboardingInput): Promise<SalvarResult> {
  const user = await requirePsicologo()
  return salvarOnboarding(user.id, input)
}
