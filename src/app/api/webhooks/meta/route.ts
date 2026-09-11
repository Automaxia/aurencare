import { NextResponse } from 'next/server'
import { processarMensagemRecebida } from '@/server/services/inbox'
import { log } from '@/server/lib/log'
import { redis } from '@/server/lib/redis'
import { env, isConfigured } from '@/server/lib/env'
import { verifyHubSignature } from '@/server/lib/webhookAuth'

/**
 * Webhook da WhatsApp Cloud API (Meta). Par do /api/webhooks/evolution pro
 * provider `meta` — o roteamento da mensagem é o mesmo (`processarMensagemRecebida`);
 * só o envelope, o handshake e a autenticação são outros.
 *
 * - GET: handshake de assinatura do webhook no painel do app Meta
 *   (hub.mode=subscribe & hub.verify_token → devolve hub.challenge em texto).
 * - POST: eventos. A Meta assina o corpo cru com o App Secret em
 *   `X-Hub-Signature-256: sha256=<hmac>` — mesmo formato que `verifyHubSignature`
 *   já valida pro Pagar.me.
 *
 * O webhook é POR APP e recebe TODOS os números da WABA assinada (a WABA é
 * compartilhada com outros produtos da Automaxia). Por isso cada evento é
 * filtrado por `metadata.phone_number_id`: o que não é do número da Audere é
 * ignorado com 200 — nunca roteado, nunca persistido.
 *
 * Sempre responde 200 rápido (a Meta reenvia em caso de 5xx/timeout e
 * desativa o webhook depois de muitas falhas). Reentrega é deduplicada pelo
 * id da mensagem em Redis.
 */

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (!isConfigured(env.metaVerifyToken)) {
    log.err('meta.webhook', 'META_WEBHOOK_VERIFY_TOKEN ausente — handshake recusado')
    return NextResponse.json({ error: 'webhook_unconfigured' }, { status: 503 })
  }
  if (mode === 'subscribe' && token === env.metaVerifyToken && challenge) {
    log.ok('meta.webhook', 'handshake aceito')
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  log.warn('meta.webhook', 'handshake rejeitado (verify_token não bate)')
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

export async function POST(req: Request) {
  const raw = await req.text()

  const sig = verifyHubSignature(raw, req.headers.get('x-hub-signature-256'), env.metaAppSecret)
  if (sig === 'invalid') {
    log.warn('meta.webhook', 'assinatura inválida — rejeitado')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }
  if (sig === 'unconfigured') {
    // Fail-closed em produção: sem App Secret qualquer um forjaria "PIX" /
    // "CANCELAR" em nome do paciente. Em dev, libera com aviso.
    if (process.env.NODE_ENV === 'production') {
      log.err('meta.webhook', 'META_APP_SECRET ausente em produção — rejeitado (fail-closed)')
      return NextResponse.json({ error: 'webhook_unconfigured' }, { status: 503 })
    }
    log.warn('meta.webhook', 'META_APP_SECRET ausente — aceitando sem verificar (dev)')
  }

  let body: any
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  if (body?.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, ignored: body?.object ?? null })
  }

  let roteadas = 0, ignoradas = 0
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const v = change.value ?? {}
      const phoneId: string | undefined = v.metadata?.phone_number_id

      // Outro número da mesma WABA (outro produto): não é nosso.
      if (env.metaPhoneNumberId && phoneId !== env.metaPhoneNumberId) {
        ignoradas += (v.messages?.length ?? 0)
        continue
      }

      // Status de entrega: só o que falhou interessa (número sem WhatsApp,
      // template recusado, fora da janela…).
      for (const s of v.statuses ?? []) {
        if (s.status === 'failed') {
          const erros = (s.errors ?? []).map((e: any) => `[${e.code}] ${e.title ?? e.message ?? ''}${e.error_data?.details ? ` — ${e.error_data.details}` : ''}`).join('; ')
          log.err('meta.webhook', `entrega falhou → ${s.recipient_id} msg=${s.id}: ${erros || 'sem detalhe'}`)
        }
      }

      for (const m of v.messages ?? []) {
        const texto = extrairTexto(m)
        const telefone: string | undefined = m.from
        if (!telefone || !texto) {
          log.warn('meta.webhook', `mensagem sem texto roteável (type=${m.type}) de ${telefone ?? '?'}`)
          continue
        }
        if (await jaProcessada(m.id)) { log.info('meta.webhook', `reentrega ignorada msg=${m.id}`); continue }

        try {
          await processarMensagemRecebida({ telefone, texto, instance: phoneId ? `meta:${phoneId}` : null })
          roteadas++
        } catch (err) {
          log.err('meta.webhook', 'falha ao processar', err)
        }
      }
    }
  }

  if (roteadas || ignoradas) log.info('meta.webhook', `roteadas=${roteadas} ignoradas(outro número)=${ignoradas}`)
  return NextResponse.json({ ok: true })
}

/**
 * Texto da mensagem conforme o tipo. Botão de resposta rápida de template
 * (`button.text`) e botão interativo voltam como texto puro, então "PIX",
 * "CONFIRMAR", "SIM" caem no mesmo parser de comandos de sempre.
 */
function extrairTexto(m: any): string | undefined {
  switch (m?.type) {
    case 'text':        return m.text?.body
    case 'button':      return m.button?.text
    case 'interactive': return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title
    case 'image':
    case 'document':
    case 'video':       return m[m.type]?.caption
    default:            return undefined
  }
}

async function jaProcessada(id: string | undefined): Promise<boolean> {
  if (!id) return false
  const r = await redis().catch(() => null)
  if (!r) return false
  // SET NX: só o primeiro a gravar processa. 24h cobre a janela de reentrega da Meta.
  const ok = await r.set(`wa-meta-msg:${id}`, '1', { NX: true, EX: 24 * 60 * 60 })
  return ok === null
}
