import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from './env'
import { log } from './log'
import { comissaoSessaoCentavos } from './planos'

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
  /** Fatia da plataforma (centavos) aplicada no split; 0 quando não houve split. */
  comissaoCentavos: number
}

type SplitRule = {
  amount: number
  type: 'flat'
  recipient_id: string
  options: { charge_processing_fee: boolean; charge_remainder_fee: boolean; liable: boolean }
}

/**
 * Monta o split da sessão: o psicólogo recebe o valor MENOS a comissão da
 * plataforma (2,5%, `COMISSAO_SESSAO_PCT`) e MENOS a taxa da Pagar.me — tudo
 * descontado na própria liquidação, para o dinheiro já cair líquido na conta
 * dele, sem transferência ou acerto posterior.
 *
 * Por que `flat` e não `percentage`: 2,5% não é inteiro, e a fatia em centavos
 * é exata, auditável e casa com o que o Financeiro exibe. As duas fatias somam
 * exatamente o valor da order (o resto vai pro psicólogo), como a API exige.
 *
 * `charge_processing_fee`/`liable` ficam SÓ na fatia do psicólogo: a taxa do
 * adquirente e o risco de chargeback são do serviço prestado, não da comissão.
 *
 * Degrada em silêncio seguro: sem `PAGARME_RECIPIENT_PLATAFORMA` ou sem
 * recipient do psicólogo, devolve `null` → a order sai SEM split (valor inteiro
 * na conta-mãe, comportamento anterior) com aviso no log.
 */
export function montarSplitSessao(
  valorCentavos: number,
  recipientPsicologo: string | null | undefined,
  escopo: string,
): { split: SplitRule[]; comissaoCentavos: number } | null {
  const plataforma = env.pagarmeRecipientPlataforma
  if (!recipientPsicologo) {
    log.warn('pagarme', `${escopo}: psicólogo sem pagarme_recipient_id — cobrança SEM split (valor fica na conta-mãe)`)
    return null
  }
  if (!plataforma) {
    log.warn('pagarme', `${escopo}: PAGARME_RECIPIENT_PLATAFORMA não configurado — cobrança SEM split (valor fica na conta-mãe)`)
    return null
  }

  const comissaoCentavos = comissaoSessaoCentavos(valorCentavos)
  const psicologoCentavos = valorCentavos - comissaoCentavos
  if (psicologoCentavos <= 0) {
    log.warn('pagarme', `${escopo}: valor ${valorCentavos} baixo demais para split — cobrança SEM split`)
    return null
  }

  return {
    comissaoCentavos,
    split: [
      {
        amount: psicologoCentavos,
        type: 'flat',
        recipient_id: recipientPsicologo,
        // Absorve a taxa da Pagar.me e o arredondamento; responde por chargeback.
        options: { charge_processing_fee: true, charge_remainder_fee: true, liable: true },
      },
      {
        amount: comissaoCentavos,
        type: 'flat',
        recipient_id: plataforma,
        // Comissão limpa: não paga taxa de processamento nem assume chargeback.
        options: { charge_processing_fee: false, charge_remainder_fee: false, liable: false },
      },
    ],
  }
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
  /**
   * CPF do paciente (só dígitos). **Obrigatório**: sem `customer.document` a
   * Pagar.me aceita a order mas reprova a charge ("The customer Document is
   * required"), devolvendo-a sem `qr_code` — o paciente receberia um link vazio.
   */
  pacienteDocumento: string
  /** Recipient do psicólogo (onboarding de recebimento) — destino do split. */
  recipientPsicologo?: string | null
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
      comissaoCentavos: comissaoSessaoCentavos(opts.valorCentavos),
    }
  }

  const s = montarSplitSessao(opts.valorCentavos, opts.recipientPsicologo, `pix sessao=${opts.sessaoId.slice(0, 8)}`)

  try {
    const { data } = await axios.post(`${BASE}/orders`, {
      items: [{ amount: opts.valorCentavos, description: `Sessão psicoterapia ${opts.sessaoId.slice(0, 8)}`, quantity: 1 }],
      customer: {
        name: opts.pacienteNome,
        email: opts.pacienteEmail ?? `${opts.sessaoId}@noemail.aurencare`,
        document: opts.pacienteDocumento.replace(/\D/g, ''),
        document_type: 'CPF',
        type: 'individual',
        phones: { mobile_phone: { country_code: '55', number: opts.pacienteTelefone.replace(/\D/g, '').slice(-9), area_code: opts.pacienteTelefone.replace(/\D/g, '').slice(-11, -9) } },
      },
      payments: [{
        payment_method: 'pix',
        pix: { expires_in: 30 * 60 },
        ...(s ? { split: s.split } : {}),
      }],
    }, { auth: auth(), timeout: 15_000 })

    const payment = data.charges?.[0]?.last_transaction
    // A order pode voltar 200 com a CHARGE reprovada (meio não habilitado, dado
    // do pagador recusado…). Aí não há `qr_code` — e seguir em frente mandaria um
    // WhatsApp com link vazio pro paciente. Falha explicitamente.
    if (!payment?.qr_code && !payment?.qr_code_url) {
      const motivo = payment?.gateway_response?.errors?.[0]?.message ?? data.charges?.[0]?.status ?? 'sem qr_code'
      log.err('pagarme', `PIX sem QR code (order ${data.id}) — charge reprovada: ${motivo}`, undefined)
      throw new Error('pagarme_pix_failed')
    }
    return {
      orderId: data.id,
      qrCode: payment?.qr_code,
      qrCodeUrl: payment?.qr_code_url,
      expiresAt,
      comissaoCentavos: s?.comissaoCentavos ?? 0,
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
  /** Recipient do psicólogo (onboarding de recebimento) — destino do split. */
  recipientPsicologo?: string | null
}): Promise<OrderCreated> {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  if (!integrationStatus.pagarme) {
    const mockId = `mock_${opts.metodo}_${opts.sessaoId.slice(0, 8)}_${Date.now()}`
    log.warn('pagarme', `[mock] checkout ${opts.metodo} criado ${mockId}`)
    return {
      orderId: mockId,
      checkoutUrl: `${env.appUrl}/mock/checkout/${mockId}`,
      expiresAt,
      comissaoCentavos: comissaoSessaoCentavos(opts.valorCentavos),
    }
  }

  const s = montarSplitSessao(opts.valorCentavos, opts.recipientPsicologo, `${opts.metodo} sessao=${opts.sessaoId.slice(0, 8)}`)

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
        ...(s ? { split: s.split } : {}),
      }],
    }, { auth: auth(), timeout: 15_000 })

    return {
      orderId: data.id,
      checkoutUrl: data.checkouts?.[0]?.payment_url,
      expiresAt,
      comissaoCentavos: s?.comissaoCentavos ?? 0,
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
