import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  /**
   * Protege todo o app exceto rotas públicas:
   * /login · /pagamento-ok (retorno do checkout, sem dados) · /cadastro · /recuperar-senha · /redefinir-senha/* · /lancamento
   * (landing pública) · /precos (vitrine de planos, anônima) · /privacidade (política LGPD, exigida pela Meta) · /onboard/* + /api/onboard/* (aceite do paciente, anônimo)
   * · /sala/* · /api/auth/* · /api/webhooks/* · /api/health · /api/ice (ICE
   * servers do WebRTC — paciente é anônimo) · /confirmar/* · /landing/* (imagens
   * públicas da landing) · /api/cron/recalcular-temas e
   * /api/cron/destravar-sessoes · /api/cron/pagamentos (manutenção, auto-protegidas por CRON_SECRET)
   * · assets internos.
   */
  matcher: [
    '/((?!login|pagamento-ok|cadastro|recuperar-senha|redefinir-senha|lancamento|precos|privacidade|landing|confirmar|onboard|sala|mock|api/auth|api/onboard|api/webhooks|api/cron/recalcular-temas|api/cron/temas-validar|api/cron/destravar-sessoes|api/cron/pagamentos|api/sala|api/wa|api/health|api/ice|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
