import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingBanner } from '@/components/layout/OnboardingBanner'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'
import { bootstrap } from '@/server/bootstrap'
import { obterAtalhos } from '@/server/services/atalhos'
import { lerStatusOnboarding } from '@/server/services/onboardingPagamento'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  bootstrap()
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const [atalhos, onboarding] = await Promise.all([
    obterAtalhos(userId),
    lerStatusOnboarding(userId),
  ])

  return (
    <AppShell>
      <Sidebar />
      <div className="app-main">
        <Topbar
          initialSessaoAtiva={atalhos.sessaoAtiva}
          initialPendencias={atalhos.pendencias}
        />
        {!onboarding.completo && <OnboardingBanner />}
        <main className="app-content">{children}</main>
      </div>
    </AppShell>
  )
}
