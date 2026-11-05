import { NextResponse } from 'next/server'
import { env } from '@/server/lib/env'
import { log } from '@/server/lib/log'
import { tokenConfere, normalizarEventoAsaas } from '@/server/lib/pagamentos/asaas/webhook'
import { registrarEvento, concluirEvento, aplicarEventoPagamento } from '@/server/services/eventosPagamento'

/**
 * Webhook do Asaas (conta raiz + subcontas). docs/asaas/sdd.md §4.3.
 *
 * 1. `asaas-access-token` == ASAAS_WEBHOOK_TOKEN (tempo constante) senão 401;
 *    produção sem token → 503 (fail-closed, como o da Pagar.me).
 * 2. `webhook_eventos` (gateway, id inteiro): já processado → 200 sem efeito.
 * 3. Normaliza → aplica → marca processado. Erro → grava e devolve 500 para o
 *    Asaas reenviar (spike: reenvio em ~32 s com o mesmo id).
 *
 * Responder rápido importa: 15 falhas seguidas pausam a fila inteira.
 */
export async function POST(req: Request) {
  const auth = tokenConfere(req.headers.get('asaas-access-token'), env.asaasWebhookToken)
  if (auth === 'invalido') {
    log.warn('asaas.webhook', 'token inválido — rejeitado')
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
  if (auth === 'sem_config') {
    if (process.env.NODE_ENV === 'production') {
      log.err('asaas.webhook', 'ASAAS_WEBHOOK_TOKEN ausente em produção — rejeitado (fail-closed)', undefined)
      return NextResponse.json({ error: 'webhook_unconfigured' }, { status: 503 })
    }
    log.warn('asaas.webhook', 'ASAAS_WEBHOOK_TOKEN ausente — aceitando sem verificar (dev)')
  }

  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const ev = normalizarEventoAsaas(payload)
  const eventoId = ev.eventoId
  try {
    if ((await registrarEvento('asaas', eventoId, String(payload?.event ?? ev.tipo), payload)) === 'duplicado') {
      return NextResponse.json({ ok: true, duplicado: true })
    }
  } catch (err) {
    log.err('asaas.webhook', 'falha ao registrar evento', err)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }

  log.info('asaas.webhook', `${payload?.event} ${eventoId} → ${ev.tipo}`)
  try {
    await aplicarEventoPagamento('asaas', ev)
    await concluirEvento('asaas', eventoId)
  } catch (err) {
    log.err('asaas.webhook', `falha ao processar ${eventoId}`, err)
    await concluirEvento('asaas', eventoId, err)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
