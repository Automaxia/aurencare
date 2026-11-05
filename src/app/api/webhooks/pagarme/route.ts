import { NextResponse } from 'next/server'
import { marcarPagamentoConfirmado, marcarPagamentoCancelado, marcarReembolsado, marcarContestado } from '@/server/services/sessoes'
import { registrarEvento, concluirEvento } from '@/server/services/eventosPagamento'
import { aplicarEventoAssinatura } from '@/server/services/assinatura'
import { log } from '@/server/lib/log'
import { env } from '@/server/lib/env'
import { verifyBasicAuth, verifyHubSignature } from '@/server/lib/webhookAuth'

/**
 * Webhook Pagar.me. §10 Fluxo 2 (pagamento confirmado).
 * Eventos esperados: order.paid · order.canceled · order.payment_failed · charge.paid
 *   · charge.refunded · charge.chargedback (antes ignorados — sdd §1, defeito 3)
 *
 * Idempotência: `webhook_eventos` (gateway='pagarme', id do hook) — o mesmo
 * evento entregue duas vezes não tem efeito duplicado (RF-PG-50).
 *
 * Autenticidade: valida o HMAC do header X-Hub-Signature com PAGARME_WEBHOOK_SECRET.
 * Sem secret configurado, libera com aviso (não quebra ambiente não conectado).
 */
export async function POST(req: Request) {
  const raw = await req.text()

  // A Pagar.me v5 autentica webhook por **Basic Auth** (painel: "Habilitar
  // autenticacao" -> Usuario + Senha), NAO por assinatura HMAC. O HMAC fica
  // como segundo caminho: se um dia vier x-hub-signature-256, ainda validamos.
  const viaBasic = verifyBasicAuth(
    req.headers.get('authorization'),
    env.pagarmeWebhookUser,
    env.pagarmeWebhookSec,
  )
  const viaHmac = viaBasic === 'ok' ? 'ok' : verifyHubSignature(
    raw,
    req.headers.get('x-hub-signature-256') ?? req.headers.get('x-hub-signature'),
    env.pagarmeWebhookSec,
  )
  // 'unconfigured' so quando NENHUM dos dois esta configurado.
  const sig: 'ok' | 'invalid' | 'unconfigured' =
    viaBasic === 'ok' || viaHmac === 'ok' ? 'ok'
    : viaBasic === 'unconfigured' && viaHmac === 'unconfigured' ? 'unconfigured'
    : 'invalid'
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

  // `payload.id` é o id do hook (hook_...); sem ele, evento+recurso+data.
  const eventoId = String(payload?.id ?? `${event}:${data?.id ?? orderId}:${payload?.created_at ?? ''}`)
  try {
    if ((await registrarEvento('pagarme', eventoId, event, payload)) === 'duplicado') {
      return NextResponse.json({ ok: true, duplicado: true })
    }
  } catch (err) {
    log.err('pagarme.webhook', 'falha ao registrar evento', err)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }

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
      await concluirEvento('pagarme', eventoId, err)
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
    }
    await concluirEvento('pagarme', eventoId)
    return NextResponse.json({ ok: true })
  }

  const ref = { gateway: 'pagarme' as const, cobrancaId: orderId }
  try {
    if (event === 'order.paid' || event === 'charge.paid') {
      // Parcelas reais e líquido: a transação do cartão traz `installments`
      // (antes pagamento_parcelas ficava sempre 1 — defeito 4).
      const tx = data?.last_transaction ?? data?.charges?.[0]?.last_transaction
      const parcelas = Number(tx?.installments) || undefined
      await marcarPagamentoConfirmado(ref, { parcelas })
    } else if (event === 'order.canceled' || event === 'order.payment_failed' || event === 'charge.payment_failed') {
      // Não sobrescreve sessão já paga (RF-PG-32) — a guarda está no serviço.
      await marcarPagamentoCancelado(ref)
    } else if (event === 'charge.refunded') {
      const parcial = Number(data?.amount) > 0 && Number(data?.canceled_amount ?? data?.amount) < Number(data?.amount)
      await marcarReembolsado(ref, parcial)
    } else if (event === 'charge.chargedback') {
      await marcarContestado(ref)
    }
  } catch (err) {
    log.err('pagarme.webhook', 'falha ao processar', err)
    await concluirEvento('pagarme', eventoId, err)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
  await concluirEvento('pagarme', eventoId)

  return NextResponse.json({ ok: true })
}
