import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { db } from '@/server/db/pool'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const { rows } = await db.query<{
          id: string; nome: string; email: string; senha_hash: string; crp: string
        }>(
          'SELECT id, nome, email, senha_hash, crp FROM psicologos WHERE email = $1 LIMIT 1',
          [String(creds.email).toLowerCase().trim()],
        )
        const u = rows[0]
        if (!u) return null
        const ok = await bcrypt.compare(String(creds.password), u.senha_hash)
        if (!ok) return null
        return { id: u.id, name: u.nome, email: u.email, crp: u.crp } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id
        token.crp = (user as any).crp
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid
        ;(session.user as any).crp = token.crp
      }
      return session
    },
  },
}
