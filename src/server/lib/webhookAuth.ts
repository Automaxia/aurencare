import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isConfigured } from './env'

/**
 * Verificação de autenticidade dos webhooks.
 *
 * Degradação segura: só EXIGE verificação quando o segredo está configurado
 * (valor real, não placeholder). Sem segredo configurado, libera e loga um
 * aviso — não quebra dev/staging nem integrações ainda não conectadas.
 */

/** Comparação em tempo constante de duas strings hex/ascii. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Valida o header estilo GitHub `X-Hub-Signature` enviado pelo Pagar.me:
 * `"<algo>=<hmac-hex>"` (ex.: `sha256=...` ou `sha1=...`), HMAC do corpo cru
 * com o webhook secret.
 *
 * @returns 'ok' | 'invalid' | 'unconfigured'
 */
export function verifyHubSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
): 'ok' | 'invalid' | 'unconfigured' {
  if (!isConfigured(secret)) return 'unconfigured'
  if (!header) return 'invalid'

  const [algoRaw, sigHex] = header.includes('=') ? header.split('=', 2) : ['sha256', header]
  const algo = algoRaw.toLowerCase() === 'sha1' ? 'sha1' : 'sha256'
  const expected = createHmac(algo, secret!).update(rawBody, 'utf8').digest('hex')
  return safeEqual(sigHex.trim().toLowerCase(), expected) ? 'ok' : 'invalid'
}

/**
 * Valida um token compartilhado simples (Evolution não assina o payload).
 * Aceita via header `x-webhook-token` ou query `?token=`.
 *
 * @returns 'ok' | 'invalid' | 'unconfigured'
 */
export function verifySharedToken(
  provided: string | null,
  secret: string | undefined,
): 'ok' | 'invalid' | 'unconfigured' {
  if (!isConfigured(secret)) return 'unconfigured'
  if (!provided) return 'invalid'
  return safeEqual(provided, secret!) ? 'ok' : 'invalid'
}
