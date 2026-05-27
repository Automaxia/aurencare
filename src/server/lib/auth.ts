import 'server-only'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/server/auth/options'
import { redirect } from 'next/navigation'

export async function requirePsicologo() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return session.user as { id: string; name?: string | null; email?: string | null; crp?: string }
}
