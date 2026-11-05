import { requirePsicologo } from '@/server/lib/auth'
import { lerStatusOnboarding, lerRascunhoOnboarding } from '@/server/services/onboardingPagamento'
import { gatewayPadrao } from '@/server/lib/pagamentos'
import { db } from '@/server/db/pool'
import { redirect } from 'next/navigation'
import { Wizard } from './wizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingRecebimentosPage() {
  const user = await requirePsicologo()
  const status = await lerStatusOnboarding(user.id)
  if (status.completo) redirect('/')

  // Tentativa anterior que o gateway recusou deixa os dados salvos — repovoa
  // o formulário em vez de fazer a pessoa redigitar tudo.
  const rascunho = await lerRascunhoOnboarding(user.id)

  // Os dois gateways exigem celular: sem ele no cadastro, o wizard pede já no
  // passo 1 (antes o erro só aparecia no último clique).
  const { rows: [psi] } = await db.query<{ telefone: string | null; email: string }>(
    `SELECT telefone, email FROM psicologos WHERE id = $1`, [user.id])

  return (
    <Wizard
      nomePsicologa={user.name ?? ''}
      inicial={rascunho}
      gateway={gatewayPadrao().nome}
      precisaTelefone={!psi?.telefone}
      email={psi?.email ?? ''}
    />
  )
}
