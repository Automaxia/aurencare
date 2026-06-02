import 'server-only'
import { Resend } from 'resend'
import { env, integrationStatus } from './env'
import { log } from './log'

/**
 * Cliente de email. Provedor: Resend.
 *
 * Quando RESEND_API_KEY não está configurada, faz no-op silencioso —
 * mesma estratégia do Evolution: log warn + segue. Permite testar fluxos
 * de cadastro sem provedor configurado.
 */

let client: Resend | null = null
function getClient(): Resend | null {
  if (!integrationStatus.resend) return null
  if (!client) client = new Resend(env.resendKey!)
  return client
}

export type EmailInput = {
  to: string
  subject: string
  html: string
  text?: string
  /** Sobrescreve EMAIL_FROM (opcional). */
  from?: string
  /** Reply-To opcional (ex: email do psicólogo). */
  replyTo?: string
}

export async function enviarEmail(input: EmailInput): Promise<{ ok: boolean; id?: string }> {
  const c = getClient()
  if (!c) {
    log.warn('email', `[mock] → ${input.to} · "${input.subject}"`)
    return { ok: false }
  }

  try {
    const r = await c.emails.send({
      from: input.from ?? env.emailFrom,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })
    if (r.error) {
      log.err('email', `falha ao enviar para ${input.to}`, r.error)
      return { ok: false }
    }
    log.ok('email', `→ ${input.to} (id=${r.data?.id})`)
    return { ok: true, id: r.data?.id }
  } catch (err) {
    log.err('email', `exceção ao enviar para ${input.to}`, err instanceof Error ? err.message : err)
    return { ok: false }
  }
}
