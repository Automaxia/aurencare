import { NextResponse } from 'next/server'
import { marcarPagamentoConfirmado, marcarPagamentoCancelado } from '@/server/services/sessoes'
import { aplicarEventoAssinatura } from '@/server/services/assinatura'
import { log } from '@/server/lib/log'
import { env } from '@/server/lib/env'
import { verifyHubSignature } from '@/server/lib/webhookAuth'

/**
 * Webhook Pagar.me. §10 Fluxo 2 (pagamento confirmado).
 * Eventos esperados: order.paid · order.canceled · order.payment_failed · charge.paid
 *
 * Autenticidade: valida o HMAC do header X-Hub-Signature com PAGARME_WEBHOOK_SECRET.
 * Sem secret configurado, libera com aviso (não quebra ambiente não conectado).
 */
export async function POST(req: Request) {
  const raw = await req.text()

  const sig = verifyHubSignature(
    raw,
    // Prefere o header sha256; o legado sha1 não é mais usado pra evitar downgrade.
    req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature'),
    env.pagarmeWebhookSec,
  )
  if (sig === 'invalid') {
    log.warn('pagarme.webhook', 'assinatura inválida — rejeitado')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }
  if (sig === 'unconfigured') {
    // Fail-closed em produção: sem secret, um webhook forjado marcaria sessão
    // como paga/confirmada e renovaria plano sem pagamento. Em dev, libera.
    if (process.env.NODE_ENV === 'production') {
      log.err('pagarme.webhook', 'PAGARME_WEBHOOK_SECRET ausente/placeholder em produção — rejeitado (fail-closed)')
      return NextResponse.json({ error: 'webhook_unconfigured' }, { status: 503 })
    }
    log.warn('pagarme.webhook', 'PAGARME_WEBHOOK_SECRET ausente — aceitando sem verificar (dev)')
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const event = payload?.type as string | undefined
  const data = payload?.data
  // Em eventos charge.*, data.id é o id da CHARGE, não da order — o id da order
  // vem em data.order_id/data.order.id. marcarPagamentoConfirmado casa por order.
  const orderId = (data?.order_id ?? data?.order?.id ?? data?.id) as string | undefined

  if (!event || !orderId) {
    log.warn('pagarme.webhook', 'evento sem type/id', payload)
    return NextResponse.json({ ok: true })
  }

  log.info('pagarme.webhook', `evento: ${event} order/sub: ${orderId}`)

  // Eventos de ASSINATURA (mensalidade do psicólogo) — identificados pela
  // presença de um subscription_id. Roteamos antes da lógica de orders de sessão.
  const subId: string | undefined =
    data?.subscription?.id
    ?? data?.subscription_id
    ?? (event.startsWith('subscription.') ? data?.id : undefined)

  if (subId) {
    const fimCiclo =
      data?.subscription?.current_cycle?.end_at
      ?? data?.current_cycle?.end_at
      ?? data?.next_billing_at
      ?? null
    try {
      if (event === 'subscription.canceled') {
        await aplicarEventoAssinatura(subId, 'cancelado')
      } else if (event.includes('payment_failed')) {
        await aplicarEventoAssinatura(subId, 'falhou')
      } else if (event === 'invoice.paid' || event === 'subscription.charged' || event === 'charge.paid') {
        await aplicarEventoAssinatura(subId, 'renovado', fimCiclo)
      }
    } catch (err) {
      log.err('pagarme.webhook', 'falha ao processar assinatura', err)
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  try {
    if (event === 'order.paid' || event === 'charge.paid') {
      await marcarPagamentoConfirmado(orderId)
    } else if (event === 'order.canceled' || event === 'order.payment_failed' || event === 'charge.payment_failed') {
      await marcarPagamentoCancelado(orderId)
    }
  } catch (err) {
    log.err('pagarme.webhook', 'falha ao processar', err)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
