import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'

/**
 * Modo Presença — sem sidebar e sem topbar. Apenas PresenceBar dentro da página.
 * §7.
 */
export default async function PresenceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <div style={{ background: 'var(--page)', minHeight: '100vh' }}>{children}</div>
}
