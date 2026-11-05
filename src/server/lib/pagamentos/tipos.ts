/**
 * Contrato neutro entre os serviços (sessões, onboarding, assinatura, webhooks)
 * e os gateways de pagamento. docs/asaas/sdd.md §2.
 *
 * Os serviços só falam com `GatewayPagamento`. Cada registro guarda o gateway em
 * que nasceu (`sessoes.gateway`, `psicologos.recebedor_gateway`,
 * `psicologos.assinatura_gateway`) e tudo que vem depois — estorno, cancelamento,
 * webhook — usa `gatewayDe(registro.gateway)`, nunca o padrão.
 */
import type { PlanoPago, Ciclo } from '../planos'

export type Gateway = 'pagarme' | 'asaas'
export type Ambiente = 'sandbox' | 'live'

// ── Recebedor (psicólogo) ─────────────────────────────────────────────────

export type EnderecoInput = {
  cep: string                 // só dígitos (8)
  logradouro: string
  numero: string              // aceita 'S/N'
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string                  // 2 letras
  referencia?: string | null
}

export type SocioInput = {
  nome: string
  cpf: string
  dataNascimento: string      // YYYY-MM-DD
  email: string
  telefone: string
  rendaMensalCentavos: number
  endereco: EnderecoInput
}

export type RecebedorInput = {
  tipoPessoa: 'PF' | 'PJ'
  documento: string           // CPF (11) ou CNPJ (14), só dígitos
  razaoSocial: string
  email: string
  telefone: string            // só dígitos, com DDD
  dataNascimento: string      // YYYY-MM-DD (nascimento PF / fundação PJ)
  rendaCentavos: number
  endereco: EnderecoInput
  /** Pagar.me: obrigatório para PJ. Asaas: ignorado. */
  socio?: SocioInput | null
  /** Pagar.me: conta de repasse. Asaas: ignorado (o titular cadastra no próprio Asaas). */
  banco?: {
    codigo: string
    agencia: string
    agenciaDv?: string | null
    conta: string
    contaDv: string
    tipo: 'corrente' | 'poupanca'
    titularNome: string
    titularDocumento: string
  } | null
  /** Asaas (PJ): MEI | LIMITED | INDIVIDUAL | ASSOCIATION. Sem valor → LIMITED. */
  tipoEmpresa?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION' | null
}

export type SituacaoRecebedor = 'pendente' | 'em_analise' | 'aprovado' | 'recusado'

export type RecebedorCriado = {
  gateway: Gateway
  ambiente: Ambiente
  /** re_... (pagarme) | id da subconta (asaas) */
  id: string
  /** Asaas: destino do split. Pagar.me: o próprio `id`. */
  walletId: string | null
  /** Asaas: apiKey da subconta — só vem uma vez. Quem chama cifra e grava. */
  apiKey: string | null
  situacao: SituacaoRecebedor
  situacaoDetalhe?: Record<string, unknown> | null
  /** true quando a subconta já existia (idempotência por CPF/CNPJ). */
  reaproveitado?: boolean
  /** Asaas: e-mail com que a subconta foi aberta, quando difere do informado (alias). */
  emailUsado?: string | null
}

/** O que o split precisa saber do psicólogo, já lido do banco. */
export type RecebedorRef = {
  gateway: Gateway
  id: string
  walletId: string | null
  /** cifrada (como está no banco) */
  apiKeyCifrada?: string | null
}

/**
 * Campo recusado pelo gateway, já no vocabulário do wizard. `traduzirRecusa`
 * (onboardingPagamento.ts) transforma em mensagem + passo do formulário.
 */
export type CampoRecusado = { caminho: string; mensagens: string[] }

export class RecebedorErro extends Error {
  constructor(
    public readonly gateway: Gateway,
    public readonly campos: CampoRecusado[],
    public readonly detalhe: unknown,
    public readonly status: number | null = null,
    public readonly mensagemGeral: string | null = null,
  ) {
    super(`${gateway}_recebedor_falhou`)
    this.name = 'RecebedorErro'
  }
}

// ── Cobrança da sessão ────────────────────────────────────────────────────

export type MetodoSessao = 'pix' | 'credito' | 'debito'

export type CobrancaSessaoInput = {
  sessaoId: string
  valorCentavos: number
  metodo: MetodoSessao
  /** Crédito: 1–6. Ignorado nos outros métodos. */
  parcelas?: number
  /** Data da sessão (ISO) — vencimento da cobrança no Asaas. */
  dataSessao?: string
  paciente: {
    id: string
    nome: string
    email?: string | null
    telefone: string
    /** CPF só dígitos. PIX exige nos dois gateways. */
    cpf?: string | null
  }
  /** Destino do split. null → cobrança SEM split (RF-PG-24). */
  recebedor: RecebedorRef | null
}

export type CobrancaCriada = {
  gateway: Gateway
  cobrancaId: string
  parcelamentoId?: string | null
  qrCode?: string | null        // copia e cola
  qrCodeUrl?: string | null     // imagem (pagarme) ou URL da fatura (asaas)
  url?: string | null           // checkout / fatura
  venceEm: string               // ISO — regra de negócio (30 min PIX, 2 h cartão)
  /** Taxa administrativa aplicada no split (centavos); 0 sem split. */
  taxaAdmCentavos: number
  /** Parcelas efetivas (crédito). */
  parcelas: number
  /** Método efetivamente cobrado (Asaas não tem débito → crédito à vista). */
  metodo: MetodoSessao
}

export type ReembolsoInput = {
  cobrancaId: string
  parcelamentoId?: string | null
  /** Sem valor = total. */
  valorCentavos?: number
}

export type ReembolsoResultado =
  /** Estornado (ou aceito pelo gateway e só aguardando liquidação). */
  | { status: 'estornado' }
  /** Aceito, mas aguardando autorização manual no painel (Asaas: evento crítico, D-09). */
  | { status: 'solicitado' }
  /** Não foi possível agora (sem saldo, "tente novamente"): fica para o cron (D-08). */
  | { status: 'pendente'; motivo: string }
  | { status: 'falhou'; motivo: string }

// ── Assinatura do plano ───────────────────────────────────────────────────

/**
 * `vencimento` (AAAA-MM-DD) = cobrança que já sai no valor novo — é quando uma
 * troca agendada passa a valer. `urlPagamento` = fatura avulsa da diferença,
 * quando o gateway ainda não gerou a próxima cobrança.
 */
export type AtualizacaoAssinatura =
  | { ok: true; vencimento: string | null; urlPagamento: string | null }
  | { ok: false }

export type AssinaturaInput = {
  plano: PlanoPago
  ciclo: Ciclo
  /** Pagar.me: token do cartão (front). Asaas: não usa — o cartão vai na fatura. */
  cardToken?: string | null
  psicologo: {
    id: string
    nome: string
    email: string
    documento?: string | null
    telefone?: string | null
  }
}

export type AssinaturaCriada = {
  gateway: Gateway
  assinaturaId: string
  /** ativa = já cobrou; aguardando_pagamento = falta o titular pagar a fatura. */
  status: 'ativa' | 'aguardando_pagamento' | 'falhou'
  proximaCobranca: string | null
  /** Asaas: fatura da 1ª cobrança (o psicólogo paga lá; o cartão fica guardado). */
  urlPagamento?: string | null
}

// ── Webhook ───────────────────────────────────────────────────────────────

export type EventoPagamento =
  | { tipo: 'cobranca.paga'; eventoId: string; cobrancaId: string; parcelamentoId?: string | null; referencia?: string | null; liquidoCentavos?: number; valorCentavos?: number; parcelas?: number }
  | { tipo: 'cobranca.falhou' | 'cobranca.vencida' | 'cobranca.cancelada'; eventoId: string; cobrancaId: string; parcelamentoId?: string | null; referencia?: string | null }
  | { tipo: 'cobranca.reembolsada'; eventoId: string; cobrancaId: string; parcelamentoId?: string | null; referencia?: string | null; parcial: boolean }
  | { tipo: 'cobranca.contestada'; eventoId: string; cobrancaId: string; parcelamentoId?: string | null; referencia?: string | null }
  | { tipo: 'cobranca.split_bloqueado'; eventoId: string; cobrancaId: string }
  | {
      tipo: 'assinatura.paga' | 'assinatura.falhou' | 'assinatura.cancelada'; eventoId: string; assinaturaId: string
      cicloFim?: string | null
      /** Vencimento (AAAA-MM-DD) da cobrança paga — decide se uma troca agendada já vale. */
      vencimento?: string | null
    }
  | { tipo: 'recebedor.situacao'; eventoId: string; recebedorId: string; situacao: SituacaoRecebedor; detalhe: Record<string, unknown> }
  | { tipo: 'ignorado'; eventoId: string; motivo: string }

// ── Interface ─────────────────────────────────────────────────────────────

export interface GatewayPagamento {
  nome: Gateway
  ambiente(): Ambiente
  /** Sem chave configurada o adaptador devolve ids `mock_*` (RF-PG-04). */
  configurado(): boolean

  criarRecebedor(input: RecebedorInput): Promise<RecebedorCriado>
  /** Ref sintética/de outro ambiente não serve para split. */
  recebedorUtilizavel(id: string | null | undefined): boolean

  criarCobrancaSessao(input: CobrancaSessaoInput): Promise<CobrancaCriada>
  reembolsar(input: ReembolsoInput): Promise<ReembolsoResultado>
  /**
   * Cancela uma cobrança ainda NÃO paga (validade é regra nossa — D-05: o QR do
   * Asaas vale 1 ano). `true` = cancelada (ou já não existia); `false` = o
   * gateway recusou (ex.: já foi paga). Ausente = o gateway expira sozinho.
   */
  cancelarCobranca?(cobrancaId: string): Promise<boolean>

  criarAssinatura(input: AssinaturaInput): Promise<AssinaturaCriada>
  /**
   * Troca de plano sem cancelar (Asaas: PUT). `acrescimoCentavos` = diferença
   * proporcional de um upgrade, somada na próxima cobrança. Ausente = não
   * suportado → cancelar + criar.
   */
  atualizarAssinatura?(assinaturaId: string, input: AssinaturaInput, acrescimoCentavos?: number): Promise<AtualizacaoAssinatura>
  cancelarAssinatura(assinaturaId: string): Promise<boolean>
  /**
   * Link da fatura em aberto da assinatura (Asaas: a 1ª cobrança ou uma
   * renovação recusada). `null` = nada em aberto. Ausente = o gateway não tem
   * fatura navegável (Pagar.me: troca o cartão).
   */
  faturaEmAberto?(assinaturaId: string): Promise<string | null>
  /** Data (AAAA-MM-DD) da próxima cobrança, como o gateway registrou. */
  proximaCobranca?(assinaturaId: string): Promise<string | null>
  /**
   * A próxima cobrança já foi gerada (PENDING)? Sem ela, a diferença de um
   * upgrade vira fatura avulsa em vez de entrar na próxima fatura.
   */
  proximaCobrancaGerada?(assinaturaId: string): Promise<boolean>
}
