import 'server-only'

/**
 * Marca o env como "configurado" se NÃO contém placeholder.
 * Permite que clients degradem para no-op quando .env.local ainda tem valor padrão.
 */
const PLACEHOLDER_HINTS = ['change-me', 'sk-ant-...', 'sk_test_...', 'ek_test_...', 'example.com']

export function isConfigured(value: string | undefined): boolean {
  if (!value || value.trim() === '') return false
  return !PLACEHOLDER_HINTS.some(p => value.includes(p))
}

export const env = {
  anthropicKey:        process.env.ANTHROPIC_API_KEY,
  evolutionUrl:        process.env.EVOLUTION_API_URL,
  evolutionKey:        process.env.EVOLUTION_API_KEY,
  evolutionInstance:   process.env.EVOLUTION_INSTANCE_NAME || 'auren-care',
  evolutionWebhookTok: process.env.EVOLUTION_WEBHOOK_TOKEN,
  pagarmeKey:          process.env.PAGARME_API_KEY,
  pagarmeWebhookSec:   process.env.PAGARME_WEBHOOK_SECRET,
  assemblyKey:         process.env.ASSEMBLYAI_API_KEY,
  resendKey:           process.env.RESEND_API_KEY,
  emailFrom:           process.env.EMAIL_FROM || 'Auren Care <onboarding@aurencare.ia.br>',
  redisUrl:            process.env.REDIS_URL,
  appUrl:              process.env.NEXTAUTH_URL || 'http://localhost:3000',
}

export const integrationStatus = {
  anthropic: isConfigured(env.anthropicKey),
  evolution: isConfigured(env.evolutionUrl) && isConfigured(env.evolutionKey),
  pagarme:   isConfigured(env.pagarmeKey),
  assembly:  isConfigured(env.assemblyKey),
  resend:    isConfigured(env.resendKey),
}
