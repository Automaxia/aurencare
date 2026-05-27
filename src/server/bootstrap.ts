import 'server-only'
import { startCron } from './lib/cron'

/**
 * Inicializa side-effects do servidor (cron, etc).
 * Chamado uma vez no primeiro hit de qualquer route handler.
 */
const globalAny = globalThis as unknown as { __aurenBootstrapped?: boolean }

export function bootstrap() {
  if (globalAny.__aurenBootstrapped) return
  globalAny.__aurenBootstrapped = true
  startCron()
}
