/**
 * Hook de instrumentação do Next: `register()` roda UMA vez quando o server
 * sobe, antes de servir tráfego. Sobe o cron in-process no boot — sem depender
 * do 1º acesso autenticado (que reiniciava o relógio a cada restart do pod).
 *
 * O guard idempotente já vive em bootstrap()/startCron(), então o boot + um
 * eventual hit de layout não duplicam agendamentos. Só no runtime Node (o
 * register também é chamado no runtime edge, onde não há cron nem `pg`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrap } = await import('@/server/bootstrap')
    bootstrap()
  }
}
