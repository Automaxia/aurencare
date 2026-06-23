import 'server-only'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'

export async function requirePsicologo() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return session.user as { id: string; name?: string | null; email?: string | null; crp?: string; role?: string }
}

/** Exige um papel específico (gestão). Não-admin é mandado pra home. */
export async function requireRole(role: 'admin') {
  const session = await getServerSession(authOptions)
  const u = session?.user as { id?: string; role?: string } | undefined
  if (!u?.id) redirect('/login')
  if (u.role !== role) redirect('/')
  return u as { id: string; name?: string | null; email?: string | null; crp?: string; role: string }
}
