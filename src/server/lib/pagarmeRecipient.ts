import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from './env'
import { log } from './log'

/**
 * Cria/atualiza Recipient (subconta) na Pagar.me v5.
 * Em modo mock (sem PAGARME_API_KEY): retorna ID sintético sem chamar API.
 *
 * Política de transferência: diária, default da Pagar.me. Pode virar
 * configurável depois (semanal pra agrupar TEDs).
 */

const BASE = 'https://api.pagar.me/core/v5'

function auth() {
  return { username: env.pagarmeKey!, password: '' }
}

export type RecipientInput = {
  tipoPessoa: 'PF' | 'PJ'
  documento: string           // CPF (11) ou CNPJ (14), só dígitos
  razaoSocial: string         // nome civil (PF) ou razão (PJ)
  email: string
  telefone: string            // só dígitos, com DDD
  dataNascimento: string      // ISO YYYY-MM-DD
  rendaCentavos: number
  banco: {
    codigo: string            // ex: '341' Itaú, '237' Bradesco
    agencia: string
    agenciaDv?: string | null
    conta: string
    contaDv: string           // dígito é obrigatório na Pagar.me
    tipo: 'corrente' | 'poupanca'
    titularNome: string
    titularDocumento: string  // CPF/CNPJ do titular, só dígitos
  }
}

export type RecipientCriado = {
  recipientId: string
  status: string              // 'registration' | 'affiliation' | 'active' | 'refused' etc
}

/**
 * Pagar.me v5 — POST /recipients. Documentação:
 * https://docs.pagar.me/reference/criar-recebedor-1
 */
export async function criarRecipient(input: RecipientInput): Promise<RecipientCriado> {
  if (!integrationStatus.pagarme) {
    const mockId = `mock_rcp_${input.documento.slice(0, 6)}_${Date.now().toString(36)}`
    log.warn('pagarme.recipient', `[mock] criado ${mockId} (${input.tipoPessoa} ${input.razaoSocial})`)
    return { recipientId: mockId, status: 'registration' }
  }

  // Pagar.me usa contas com tipos específicos. Mapeamento:
  const tipoConta = ({
    corrente:  'checking',
    poupanca:  'savings',
  } as const)[input.banco.tipo]

  const doc = input.documento.replace(/\D/g, '')
  const titularDoc = input.banco.titularDocumento.replace(/\D/g, '')
  const tel = input.telefone.replace(/\D/g, '')

  const payload = {
    register_information: {
      type: input.tipoPessoa === 'PF' ? 'individual' : 'corporation',
      email: input.email,
      document: doc,
      ...(input.tipoPessoa === 'PF'
        ? {
            name: input.razaoSocial,
            birthdate: input.dataNascimento,
            monthly_income: input.rendaCentavos,
            professional_occupation: 'Psicóloga(o) clínica(o)',
          }
        : {
            company_name: input.razaoSocial,
            trading_name: input.razaoSocial,
            founding_date: input.dataNascimento,
            annual_revenue: input.rendaCentavos * 12,
          }),
      phone_numbers: [{
        ddd: tel.slice(0, 2),
        number: tel.slice(2),
        type: 'mobile',
      }],
    },
    default_bank_account: {
      holder_name: input.banco.titularNome,
      holder_type: titularDoc.length === 11 ? 'individual' : 'company',
      holder_document: titularDoc,
      bank: input.banco.codigo,
      branch_number: input.banco.agencia,
      branch_check_digit: input.banco.agenciaDv ?? undefined,
      account_number: input.banco.conta,
      account_check_digit: input.banco.contaDv,
      type: tipoConta,
    },
    transfer_settings: {
      transfer_enabled: true,
      transfer_interval: 'daily',
      transfer_day: 0,
    },
    automatic_anticipation_settings: { enabled: false },
  }

  try {
    const { data } = await axios.post(`${BASE}/recipients`, payload, {
      auth: auth(),
      timeout: 20_000,
    })
    log.ok('pagarme.recipient', `criado ${data.id} (status=${data.status})`)
    return { recipientId: data.id, status: data.status ?? 'registration' }
  } catch (err) {
    const detail = axios.isAxiosError(err) ? err.response?.data : err
    log.err('pagarme.recipient', 'falha ao criar', detail)
    throw new Error('pagarme_recipient_failed')
  }
}
