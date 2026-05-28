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
    '/((?!login|cadastro|onboard|sala|api/auth|api/webhooks|api/sala|_next/static|_next/image|favicon.ico).*)',
  ],
}
