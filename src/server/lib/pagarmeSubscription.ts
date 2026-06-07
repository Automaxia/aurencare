import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from './env'
import { log } from './log'
import type { PlanoPago, Ciclo } from './planos'
import { PLANOS, precoCentavos } from './planos'

/**
 * Assinatura recorrente da mensalidade do psicólogo — Pagar.me v5 Subscriptions.
 * Cartão de crédito, cobrança automática (mensal ou anual). §Pricing.
 *
 * O cartão é tokenizado NO FRONTEND (Pagar.me tokenizecard com a public key) —
 * o backend nunca vê o PAN. Recebemos só o `cardToken` e criamos a assinatura.
 *
 * Modo mock (sem PAGARME_API_KEY): devolve subscription_id sintético.
 */

const BASE = 'https://api.pagar.me/core/v5'

function auth() {
  return { username: env.pagarmeKey!, password: '' }
}

const INTERVAL: Record<Ciclo, { interval: 'month' | 'year'; interval_count: number }> = {
  mensal: { interval: 'month', interval_count: 1 },
  anual:  { interval: 'year',  interval_count: 1 },
}

export type SubscriptionCreated = {
  subscriptionId: string
  status: string                 // 'active' | 'future' | 'failed' | ...
  proximaCobranca: string | null // ISO da próxima cobrança, se disponível
}

export async function criarAssinatura(opts: {
  plano: PlanoPago
  ciclo: Ciclo
  cardToken: string
  psicologo: {
    id: string
    nome: string
    email: string
    documento?: string | null      // CPF/CNPJ só dígitos (opcional)
    telefone?: string | null       // só dígitos com DDD (opcional)
  }
}): Promise<SubscriptionCreated> {
  const valorCentavos = precoCentavos(opts.plano, opts.ciclo)
  const cfg = PLANOS[opts.plano]
  const periodo = INTERVAL[opts.ciclo]

  if (!integrationStatus.pagarme) {
    const mockId = `mock_sub_${opts.plano}_${opts.psicologo.id.slice(0, 8)}_${Date.now()}`
    log.warn('pagarme.sub', `[mock] assinatura ${opts.plano}/${opts.ciclo} criada ${mockId} valor=${valorCentavos}`)
    return { subscriptionId: mockId, status: 'active', proximaCobranca: null }
  }

  const documento = opts.psicologo.documento?.replace(/\D/g, '') || undefined
  const tel = opts.psicologo.telefone?.replace(/\D/g, '')

  try {
    const { data } = await axios.post(`${BASE}/subscriptions`, {
      code: `auren_${opts.plano}_${opts.psicologo.id}`,
      payment_method: 'credit_card',
      billing_type: 'prepaid',
      ...periodo,
      card_token: opts.cardToken,
      customer: {
        name: opts.psicologo.nome,
        email: opts.psicologo.email,
        ...(documento ? { document: documento, type: documento.length > 11 ? 'company' : 'individual' } : {}),
        ...(tel ? { phones: { mobile_phone: { country_code: '55', area_code: tel.slice(-11, -9), number: tel.slice(-9) } } } : {}),
      },
      items: [{
        description: `Audere ${cfg.nome} (${opts.ciclo})`,
        quantity: 1,
        pricing_scheme: { scheme_type: 'unit', price: valorCentavos },
      }],
    }, { auth: auth(), timeout: 20_000 })

    log.ok('pagarme.sub', `assinatura ${data.id} criada (${opts.plano}/${opts.ciclo}) status=${data.status}`)
    return {
      subscriptionId: data.id,
      status: data.status ?? 'active',
      proximaCobranca: data.next_billing_at ?? data.current_cycle?.end_at ?? null,
    }
  } catch (err) {
    const detalhe = axios.isAxiosError(err) ? JSON.stringify(err.response?.data ?? err.message) : err
    log.err('pagarme.sub', `falha ao criar assinatura ${opts.plano}/${opts.ciclo}`, detalhe)
    throw new Error('pagarme_subscription_failed')
  }
}

/** Cancela a assinatura recorrente. Idempotente em modo mock. */
export async function cancelarAssinatura(subscriptionId: string): Promise<boolean> {
  if (subscriptionId.startsWith('mock_sub_')) {
    log.warn('pagarme.sub', `[mock] cancelamento de ${subscriptionId}`)
    return true
  }
  try {
    await axios.delete(`${BASE}/subscriptions/${subscriptionId}`, { auth: auth(), timeout: 15_000 })
    log.ok('pagarme.sub', `assinatura ${subscriptionId} cancelada`)
    return true
  } catch (err) {
    log.err('pagarme.sub', `falha ao cancelar ${subscriptionId}`, err instanceof Error ? err.message : err)
    return false
  }
}

/** Consulta status atual da assinatura (reconciliação). null se não encontrada. */
export async function obterAssinatura(subscriptionId: string): Promise<{ status: string; proximaCobranca: string | null } | null> {
  if (subscriptionId.startsWith('mock_sub_')) {
    return { status: 'active', proximaCobranca: null }
  }
  try {
    const { data } = await axios.get(`${BASE}/subscriptions/${subscriptionId}`, { auth: auth(), timeout: 15_000 })
    return {
      status: data.status ?? 'unknown',
      proximaCobranca: data.next_billing_at ?? data.current_cycle?.end_at ?? null,
    }
  } catch (err) {
    log.err('pagarme.sub', `falha ao consultar ${subscriptionId}`, err instanceof Error ? err.message : err)
    return null
  }
}
