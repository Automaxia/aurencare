import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingBanner } from '@/components/layout/OnboardingBanner'
import { PlanoUsoBanner } from '@/components/layout/PlanoUsoBanner'
import { ToastProvider } from '@/components/feedback/Toast'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'
import { bootstrap } from '@/server/bootstrap'
import { obterAtalhos } from '@/server/services/atalhos'
import { lerStatusOnboarding } from '@/server/services/onboardingPagamento'
import { obterAssinatura } from '@/server/services/assinatura'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  bootstrap()
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const [atalhos, onboarding, assinatura] = await Promise.all([
    obterAtalhos(userId),
    lerStatusOnboarding(userId),
    obterAssinatura(userId),
  ])

  const planoBanner: 'limite' | 'inadimplente' | null =
    assinatura.status === 'inadimplente' ? 'inadimplente'
    : assinatura.restantes === 0 ? 'limite'
    : null

  return (
    <AppShell>
      <Sidebar />
      <div className="app-main">
        <Topbar
          initialSessaoAtiva={atalhos.sessaoAtiva}
          initialPendencias={atalhos.pendencias}
        />
        <ToastProvider>
          {!onboarding.completo && <OnboardingBanner />}
          {planoBanner && <PlanoUsoBanner motivo={planoBanner} cap={assinatura.cap} />}
          <main className="app-content">{children}</main>
        </ToastProvider>
      </div>
    </AppShell>
  )
}
