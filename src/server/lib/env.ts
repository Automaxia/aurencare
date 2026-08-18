import 'server-only'

/**
 * Marca o env como "configurado" se NÃO contém placeholder.
 * Permite que clients degradem para no-op quando .env.local ainda tem valor padrão.
 *
 * A lista precisa cobrir os placeholders do `.env.example` e do
 * `k8s/aurencare-secrets.example.yaml` — se um deles escapar, o valor falso
 * passa por "configurado" e o client tenta chamada real, falhando com 401 em
 * vez de degradar. Já aconteceu ao contrário também: `sk_test_...` no secret de
 * produção deixou o app inteiro em modo mock (link de cobrança 404).
 */
const PLACEHOLDER_HINTS = [
  'change-me', 'example.com',
  'sk-ant-...', 'sk-proj-...',
  'sk_test_...', 'sk_live_...', 'pk_test_...', 'pk_live_...',
  'ek_test_...', 'ek_live_...', 'ak_live_...',
  '<', '>',                       // pega `<webhook-secret-do-painel-pagarme>` e afins
  'seu_token_aqui', 'coloque-', 'preencha-',
]

export function isConfigured(value: string | undefined): boolean {
  if (!value || value.trim() === '') return false
  return !PLACEHOLDER_HINTS.some(p => value.includes(p))
}

export const env = {
  openaiKey:           process.env.OPENAI_API_KEY,
  anthropicKey:        process.env.ANTHROPIC_API_KEY,
  evolutionUrl:        process.env.EVOLUTION_API_URL,
  evolutionKey:        process.env.EVOLUTION_API_KEY,
  evolutionInstance:   process.env.EVOLUTION_INSTANCE_NAME || 'auren-care',
  evolutionWebhookTok: process.env.EVOLUTION_WEBHOOK_TOKEN,
  pagarmeKey:          process.env.PAGARME_API_KEY,
  pagarmeWebhookSec:   process.env.PAGARME_WEBHOOK_SECRET,
  // Recipient da conta da PLATAFORMA — destino da comissão por sessão no split.
  // Sem ele não há como dividir: a cobrança sai sem split e o valor inteiro cai
  // na conta-mãe (ver `montarSplitSessao` em pagarme.ts).
  pagarmeRecipientPlataforma: process.env.PAGARME_RECIPIENT_PLATAFORMA,
  assemblyKey:         process.env.ASSEMBLYAI_API_KEY,
  resendKey:           process.env.RESEND_API_KEY,
  emailFrom:           process.env.EMAIL_FROM || 'Audere <onboarding@aurencare.ia.br>',
  adminAlertEmail:     process.env.ADMIN_ALERT_EMAIL,   // alertas operacionais (fallback de custo, etc)
  redisUrl:            process.env.REDIS_URL,
  appUrl:              process.env.NEXTAUTH_URL || 'http://localhost:3000',
}

export const integrationStatus = {
  openai:    isConfigured(env.openaiKey),
  anthropic: isConfigured(env.anthropicKey),
  evolution: isConfigured(env.evolutionUrl) && isConfigured(env.evolutionKey),
  pagarme:   isConfigured(env.pagarmeKey),
  assembly:  isConfigured(env.assemblyKey),
  resend:    isConfigured(env.resendKey),
}
