import { NextResponse } from 'next/server'
import { marcarPagamentoConfirmado, marcarPagamentoCancelado } from '@/server/services/sessoes'
import { log } from '@/server/lib/log'

/**
 * Webhook Pagar.me. §10 Fluxo 2 (pagamento confirmado).
 * Eventos esperados: order.paid · order.canceled · order.payment_failed · charge.paid
 */
export async function POST(req: Request) {
  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const event = payload?.type as string | undefined
  const orderId = payload?.data?.id as string | undefined

  if (!event || !orderId) {
    log.warn('pagarme.webhook', 'evento sem type/id', payload)
    return NextResponse.json({ ok: true })
  }

  log.info('pagarme.webhook', `evento: ${event} order: ${orderId}`)

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
