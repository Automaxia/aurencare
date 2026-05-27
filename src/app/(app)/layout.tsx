import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'
import { bootstrap } from '@/server/bootstrap'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  bootstrap()
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // TODO: buscar sessão ativa do psicólogo no Redis/DB.
  const activeSession = null

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar activeSession={activeSession} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
