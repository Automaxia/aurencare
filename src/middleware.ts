import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  /**
   * Protege todo o app exceto rotas públicas:
   * /login · /cadastro · /recuperar-senha · /redefinir-senha/* · /lancamento
   * (landing pública) · /onboard/* + /api/onboard/* (aceite do paciente, anônimo)
   * · /sala/* · /api/auth/* · /api/webhooks/* · /api/health · /api/ice (ICE
   * servers do WebRTC — paciente é anônimo) · /confirmar/* · /landing/* (imagens
   * públicas da landing) · /api/cron/recalcular-temas (manutenção, auto-protegida
   * por CRON_SECRET) · assets internos.
   */
  matcher: [
    '/((?!login|cadastro|recuperar-senha|redefinir-senha|lancamento|landing|confirmar|onboard|sala|api/auth|api/onboard|api/webhooks|api/cron/recalcular-temas|api/cron/temas-validar|api/sala|api/wa|api/health|api/ice|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
