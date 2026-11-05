import 'server-only'
/**
 * Ponto único de acesso aos gateways (sdd §2).
 *
 * - `gatewayPadrao()`: para o que vai NASCER agora (cobrança, recebedor,
 *   assinatura). Lê `PAYMENT_GATEWAY` (pagarme | asaas).
 * - `gatewayDe(nome)`: para o que JÁ EXISTE — estorno, cancelamento, webhook.
 *   Registro sem gateway gravado é anterior à migration 053 → Pagar.me.
 */
import { env } from '../env'
import { pagarmeGateway } from './pagarme'
import { asaasGateway } from './asaas'
import type { Gateway, GatewayPagamento } from './tipos'

export * from './tipos'

const GATEWAYS: Record<Gateway, GatewayPagamento> = { pagarme: pagarmeGateway, asaas: asaasGateway }

export function gatewayPadrao(): GatewayPagamento {
  return GATEWAYS[env.paymentGateway]
}

export function gatewayDe(nome: string | null | undefined): GatewayPagamento {
  return GATEWAYS[(nome === 'asaas' ? 'asaas' : 'pagarme')]
}

/** Nome legível para a UI (Financeiro, admin). */
export function nomeGateway(g: string | null | undefined): string {
  return g === 'asaas' ? 'Asaas' : 'Pagar.me'
}
