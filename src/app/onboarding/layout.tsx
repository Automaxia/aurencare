import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'
import { bootstrap } from '@/server/bootstrap'
import { Logo } from '@/components/brand/Logo'
import Link from 'next/link'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  bootstrap()
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--page)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Logo size={28} />
        </Link>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Configuração inicial</span>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>{children}</div>
      </main>
    </div>
  )
}
