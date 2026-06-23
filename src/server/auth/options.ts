import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { db } from '@/server/db/pool'

export const authOptions: NextAuthOptions = {
  // Timeout absoluto a partir do login (8h — cobre um dia de atendimentos sem
  // deslogar no meio da sessão). O teste de 30min foi revertido.
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
          id: string; nome: string; email: string; senha_hash: string; crp: string;
          status: string | null; role: string | null
        }>(
          'SELECT id, nome, email, senha_hash, crp, status, role FROM psicologos WHERE email = $1 LIMIT 1',
          [String(creds.email).toLowerCase().trim()],
        )
        const u = rows[0]
        if (!u) return null
        const ok = await bcrypt.compare(String(creds.password), u.senha_hash)
        if (!ok) return null
        // Gestão: conta SUSPENSA não loga. Bloqueia SÓ 'suspenso' — o único valor
        // que a gestão seta (ciclo ativo↔suspenso). Não bloqueia 'inativo' nem
        // outros (podem ser status legado de psicólogo e travariam por engano).
        if (u.status === 'suspenso') return null
        return { id: u.id, name: u.nome, email: u.email, crp: u.crp, role: u.role ?? 'psicologo' } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id
        token.crp = (user as any).crp
        token.role = (user as any).role ?? 'psicologo'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid
        ;(session.user as any).crp = token.crp
        ;(session.user as any).role = token.role ?? 'psicologo'
      }
      return session
    },
  },
}
