import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from './env'
import { log } from './log'

/**
 * Cliente Pagar.me v5. §10 (pagamentos).
 * Em modo mock: gera order_id sintético e URLs falsos.
 */

const BASE = 'https://api.pagar.me/core/v5'

function auth() {
  return { username: env.pagarmeKey!, password: '' }
}

export type OrderCreated = {
  orderId: string
  qrCode?: string         // PIX BR Code (string)
  qrCodeUrl?: string      // URL da imagem do QR
  checkoutUrl?: string    // para cartão
  expiresAt: string
}

/**
 * Cria order PIX com expiração de 30 minutos.
 */
export async function criarOrderPix(opts: {
  sessaoId: string
  valorCentavos: number
  pacienteNome: string
  pacienteEmail?: string | null
  pacienteTelefone: string
}): Promise<OrderCreated> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  if (!integrationStatus.pagarme) {
    const mockId = `mock_pix_${opts.sessaoId.slice(0, 8)}_${Date.now()}`
    log.warn('pagarme', `[mock] PIX criado ${mockId} valor=${opts.valorCentavos}`)
    return {
      orderId: mockId,
      qrCode: '00020126...mock-br-code...',
      qrCodeUrl: `${env.appUrl}/mock/qr/${mockId}.png`,
      expiresAt,
    }
  }

  try {
    const { data } = await axios.post(`${BASE}/orders`, {
      items: [{ amount: opts.valorCentavos, description: `Sessão psicoterapia ${opts.sessaoId.slice(0, 8)}`, quantity: 1 }],
      customer: {
        name: opts.pacienteNome,
        email: opts.pacienteEmail ?? `${opts.sessaoId}@noemail.aurencare`,
        phones: { mobile_phone: { country_code: '55', number: opts.pacienteTelefone.replace(/\D/g, '').slice(-9), area_code: opts.pacienteTelefone.replace(/\D/g, '').slice(-11, -9) } },
      },
      payments: [{
        payment_method: 'pix',
        pix: { expires_in: 30 * 60 },
      }],
    }, { auth: auth(), timeout: 15_000 })

    const payment = data.charges?.[0]?.last_transaction
    return {
      orderId: data.id,
      qrCode: payment?.qr_code,
      qrCodeUrl: payment?.qr_code_url,
      expiresAt,
    }
  } catch (err) {
    log.err('pagarme', 'falha ao criar PIX', err instanceof Error ? err.message : err)
    throw new Error('pagarme_pix_failed')
  }
}

/**
 * Cria checkout cartão (crédito até 6x, ou débito).
 */
export async function criarCheckoutCartao(opts: {
  sessaoId: string
  valorCentavos: number
  metodo: 'credito' | 'debito'
  parcelas?: number
  pacienteNome: string
  pacienteEmail?: string | null
}): Promise<OrderCreated> {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  if (!integrationStatus.pagarme) {
    const mockId = `mock_${opts.metodo}_${opts.sessaoId.slice(0, 8)}_${Date.now()}`
    log.warn('pagarme', `[mock] checkout ${opts.metodo} criado ${mockId}`)
    return {
      orderId: mockId,
      checkoutUrl: `${env.appUrl}/mock/checkout/${mockId}`,
      expiresAt,
    }
  }

  try {
    const { data } = await axios.post(`${BASE}/orders`, {
      items: [{ amount: opts.valorCentavos, description: `Sessão psicoterapia ${opts.sessaoId.slice(0, 8)}`, quantity: 1 }],
      customer: { name: opts.pacienteNome, email: opts.pacienteEmail ?? `${opts.sessaoId}@noemail.aurencare` },
      payments: [{
        payment_method: 'checkout',
        checkout: {
          expires_in: 2 * 60 * 60,
          accepted_payment_methods: [opts.metodo === 'credito' ? 'credit_card' : 'debit_card'],
          // Pagar.me exige `total` (valor em centavos) por parcela. Sem juros:
          // o total é o mesmo valor da sessão em qualquer nº de parcelas.
          credit_card: opts.metodo === 'credito'
            ? { installments: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, total: opts.valorCentavos })) }
            : undefined,
          success_url: `${env.appUrl}/pagamento-ok`,
        },
      }],
    }, { auth: auth(), timeout: 15_000 })

    return {
      orderId: data.id,
      checkoutUrl: data.checkouts?.[0]?.payment_url,
      expiresAt,
    }
  } catch (err) {
    log.err('pagarme', `falha ao criar checkout ${opts.metodo}`, err instanceof Error ? err.message : err)
    throw new Error('pagarme_checkout_failed')
  }
}

/**
 * Reembolso (Fluxo 5).
 */
export async function reembolsar(orderId: string): Promise<boolean> {
  if (orderId.startsWith('mock_')) {
    log.warn('pagarme', `[mock] reembolso de ${orderId}`)
    return true
  }
  try {
    await axios.delete(`${BASE}/orders/${orderId}`, { auth: auth(), timeout: 10_000 })
    log.ok('pagarme', `reembolso emitido para ${orderId}`)
    return true
  } catch (err) {
    log.err('pagarme', `falha no reembolso de ${orderId}`, err instanceof Error ? err.message : err)
    return false
  }
}
