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

/**
 * Endereço — **obrigatório** nos dois tipos (a Pagar.me recusa sem ele):
 * `address` para `individual`, `main_address` para `corporation`.
 */
export type EnderecoInput = {
  cep: string                 // só dígitos (8)
  logradouro: string
  numero: string              // aceita 'S/N'
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string                  // 2 letras
  /** Ponto de referência — a Pagar.me EXIGE o campo; sem valor mandamos 'N/A'. */
  referencia?: string | null
}

/**
 * Sócio administrador — **obrigatório para PJ** (`managing_partners` precisa de
 * ao menos um item). Não se aplica a PF.
 */
export type SocioInput = {
  nome: string
  cpf: string                 // só dígitos (11)
  dataNascimento: string      // ISO YYYY-MM-DD
  email: string
  telefone: string            // só dígitos, com DDD
  rendaMensalCentavos: number
  endereco: EnderecoInput
}

export type RecipientInput = {
  tipoPessoa: 'PF' | 'PJ'
  documento: string           // CPF (11) ou CNPJ (14), só dígitos
  razaoSocial: string         // nome civil (PF) ou razão (PJ)
  email: string
  telefone: string            // só dígitos, com DDD
  dataNascimento: string      // ISO YYYY-MM-DD (nascimento PF / fundação PJ)
  rendaCentavos: number
  /** Obrigatório nos dois tipos. */
  endereco: EnderecoInput
  /** Obrigatório quando `tipoPessoa === 'PJ'`. */
  socio?: SocioInput | null
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

/**
 * A Pagar.me recusa `holder_name` com 30 caracteres ou mais. Razão social de PJ
 * quase sempre estoura, então cortamos em 29 — a conta é identificada pelo
 * `holder_document`, o nome serve para conferência visual.
 */
const HOLDER_NAME_MAX = 29
function truncarTitular(nome: string): string {
  const n = nome.trim()
  if (n.length <= HOLDER_NAME_MAX) return n
  const cortado = n.slice(0, HOLDER_NAME_MAX).trim()
  log.warn('pagarme.recipient', `titular truncado para caber no limite da Pagar.me: "${n}" → "${cortado}"`)
  return cortado
}

/** Endereço no formato da Pagar.me v5. */
function enderecoPagarme(e: EnderecoInput) {
  return {
    street: e.logradouro.trim(),
    street_number: e.numero.trim(),
    complementary: e.complemento?.trim() || undefined,
    neighborhood: e.bairro.trim(),
    city: e.cidade.trim(),
    state: e.uf.trim().toUpperCase(),
    zip_code: e.cep.replace(/\D/g, ''),
    // Obrigatório na API, mesmo sem valor real informado pelo usuário.
    reference_point: e.referencia?.trim() || 'N/A',
  }
}

export type RecipientCriado = {
  recipientId: string
  status: string              // 'registration' | 'affiliation' | 'active' | 'refused' etc
}

/**
 * Recipient sintético, criado enquanto a integração estava em modo mock —
 * não existe na Pagar.me.
 *
 * Isso não é hipotético: enquanto `PAGARME_API_KEY` era o placeholder literal
 * (INFRA.md §1), o onboarding de recebimento gravou `mock_rcp_*` para
 * psicólogos reais, que passaram a constar como "recebimento configurado".
 * Usar um desses num split faz a Pagar.me recusar a order inteira — a cobrança
 * do paciente falha. Quem lê `pagarme_recipient_id` precisa filtrar por aqui.
 */
export function isRecipientMock(recipientId: string | null | undefined): boolean {
  return !!recipientId && recipientId.startsWith('mock_rcp_')
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

  if (input.tipoPessoa === 'PJ' && !input.socio) {
    log.err('pagarme.recipient', 'PJ sem sócio administrador — a Pagar.me exige ao menos um managing_partner', undefined)
    throw new Error('pagarme_recipient_socio_obrigatorio')
  }

  const telefonePagarme = (t: string) => {
    const d = t.replace(/\D/g, '')
    return { ddd: d.slice(0, 2), number: d.slice(2), type: 'mobile' }
  }

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
            // `address` (não `main_address`) é o nome do campo para individual.
            address: enderecoPagarme(input.endereco),
          }
        : {
            company_name: input.razaoSocial,
            trading_name: input.razaoSocial,
            founding_date: input.dataNascimento,
            annual_revenue: input.rendaCentavos * 12,
            main_address: enderecoPagarme(input.endereco),
            // Ao menos um sócio é obrigatório; enviamos o administrador como
            // representante legal autodeclarado.
            managing_partners: [{
              name: input.socio!.nome.trim(),
              email: input.socio!.email,
              document: input.socio!.cpf.replace(/\D/g, ''),
              type: 'individual',
              birthdate: input.socio!.dataNascimento,
              monthly_income: input.socio!.rendaMensalCentavos,
              professional_occupation: 'Psicóloga(o) clínica(o)',
              self_declared_legal_representative: true,
              address: enderecoPagarme(input.socio!.endereco),
              phone_numbers: [telefonePagarme(input.socio!.telefone)],
            }],
          }),
      phone_numbers: [{
        ddd: tel.slice(0, 2),
        number: tel.slice(2),
        type: 'mobile',
      }],
    },
    default_bank_account: {
      // A Pagar.me limita o titular a 30 caracteres ("Bank account holder name
      // must be lower than 30 characters"). Razão social costuma passar disso,
      // então truncamos — quem identifica a conta é o `holder_document`.
      holder_name: truncarTitular(input.banco.titularNome),
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
    const campos = extrairErrosDeCampo(detail)
    log.err(
      'pagarme.recipient',
      campos.length
        ? `falha ao criar — campos recusados: ${campos.map(c => c.caminho).join(', ')}`
        : 'falha ao criar',
      detail,
    )
    throw new PagarmeRecipientError(campos, detail)
  }
}

/** Um campo recusado pela Pagar.me: caminho no payload + o que ela disse. */
export type CampoRecusado = { caminho: string; mensagens: string[] }

/**
 * Erro de criação de recebedor que CARREGA os campos recusados.
 *
 * Antes só se lançava `pagarme_recipient_failed`, e a tela dizia "verifique a
 * conta bancária" para qualquer recusa — inclusive endereço, data de nascimento
 * ou sócio. Quem via a mensagem revisava a conta bancária, que estava certa.
 */
export class PagarmeRecipientError extends Error {
  constructor(public readonly campos: CampoRecusado[], public readonly detalhe: unknown) {
    super('pagarme_recipient_failed')
    this.name = 'PagarmeRecipientError'
  }
}

/**
 * Normaliza o corpo de erro da Pagar.me v5. Ela responde em mais de um formato
 * conforme o tipo de falha, então aceitamos os três que já vimos:
 *   { errors: { "campo.path": ["msg"] } }        ← validação por campo
 *   { errors: [{ message: "..." }] }             ← lista simples
 *   { message: "..." }                           ← só a mensagem
 */
export function extrairErrosDeCampo(detail: unknown): CampoRecusado[] {
  const d = detail as any
  const errs = d?.errors
  if (!errs) return []

  if (Array.isArray(errs)) {
    return errs
      .map((e: any) => ({ caminho: e?.field ?? e?.parameter_name ?? '', mensagens: [String(e?.message ?? e)] }))
      .filter(c => c.caminho || c.mensagens[0])
  }
  if (typeof errs === 'object') {
    return Object.entries(errs).map(([caminho, msgs]) => ({
      caminho,
      mensagens: Array.isArray(msgs) ? msgs.map(String) : [String(msgs)],
    }))
  }
  return []
}
