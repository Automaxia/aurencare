import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  /**
   * Protege todo o app exceto rotas públicas:
   * /login · /onboard/* · /api/auth/* · /api/webhooks/* · assets internos.
   */
  matcher: [
    '/((?!login|onboard|api/auth|api/webhooks|_next/static|_next/image|favicon.ico).*)',
  ],
}
