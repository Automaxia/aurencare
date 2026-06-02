import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  /**
   * Protege todo o app exceto rotas públicas:
   * /login · /cadastro · /lancamento (landing pública) · /onboard/* · /sala/*
   * · /api/auth/* · /api/webhooks/* · /api/health · /confirmar/* · assets internos.
   */
  matcher: [
    '/((?!login|cadastro|lancamento|confirmar|onboard|sala|api/auth|api/webhooks|api/sala|api/wa|api/health|_next/static|_next/image|favicon.ico).*)',
  ],
}
