import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      crp?: string
      role?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    crp?: string
    role?: string
  }
}
