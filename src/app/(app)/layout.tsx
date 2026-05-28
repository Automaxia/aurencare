import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AppShell } from '@/components/layout/AppShell'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'
import { bootstrap } from '@/server/bootstrap'
import { obterAtalhos } from '@/server/services/atalhos'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  bootstrap()
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const atalhos = await obterAtalhos((session.user as any).id)

  return (
    <AppShell>
      <Sidebar />
      <div className="app-main">
        <Topbar
          initialSessaoAtiva={atalhos.sessaoAtiva}
          initialPendencias={atalhos.pendencias}
        />
        <main className="app-content">{children}</main>
      </div>
    </AppShell>
  )
}
