import 'server-only'
import { startCron } from './lib/cron'
import { verificarSaudeIA } from './lib/llm'

/**
 * Inicializa side-effects do servidor (cron, health-check de IA, etc).
 * Chamado uma vez no primeiro hit de qualquer route handler.
 */
const globalAny = globalThis as unknown as { __aurenBootstrapped?: boolean }

export function bootstrap() {
  if (globalAny.__aurenBootstrapped) return
  globalAny.__aurenBootstrapped = true
  startCron()
  // Grita no boot se a OpenAI (primário do tier fast) estiver fora — evita
  // degradar 8× silenciosamente. Não bloqueia o boot (fire-and-forget).
  void verificarSaudeIA()
}
