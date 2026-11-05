import 'server-only'
/**
 * Adaptador Pagar.me → `GatewayPagamento`.
 *
 * Os clientes HTTP continuam em `lib/pagarme.ts`, `lib/pagarmeRecipient.ts` e
 * `lib/pagarmeSubscription.ts` (scripts e testes antigos importam de lá). Este
 * arquivo só traduz para o contrato neutro — comportamento idêntico ao de antes.
 */
import { integrationStatus } from '../env'
import { criarOrderPix, criarCheckoutCartao, reembolsar } from '../pagarme'
import { criarRecipient, isRecipientMock, ambientePagarme, PagarmeRecipientError } from '../pagarmeRecipient'
import { criarAssinatura, cancelarAssinatura } from '../pagarmeSubscription'
import {
  RecebedorErro,
  type GatewayPagamento, type RecebedorInput, type RecebedorCriado,
  type CobrancaSessaoInput, type CobrancaCriada, type ReembolsoInput, type ReembolsoResultado,
  type AssinaturaInput, type AssinaturaCriada,
} from './tipos'

export const pagarmeGateway: GatewayPagamento = {
  nome: 'pagarme',
  ambiente: ambientePagarme,
  configurado: () => integrationStatus.pagarme,

  async criarRecebedor(input: RecebedorInput): Promise<RecebedorCriado> {
    if (!input.banco) {
      throw new RecebedorErro('pagarme', [{ caminho: 'default_bank_account', mensagens: ['conta bancária obrigatória'] }], null)
    }
    try {
      const r = await criarRecipient({ ...input, banco: input.banco, socio: input.socio ?? null })
      return {
        gateway: 'pagarme', ambiente: ambientePagarme(),
        id: r.recipientId, walletId: r.recipientId, apiKey: null,
        situacao: r.status === 'refused' ? 'recusado' : r.status === 'active' ? 'aprovado' : 'em_analise',
      }
    } catch (err) {
      if (err instanceof PagarmeRecipientError) {
        throw new RecebedorErro('pagarme', err.campos, err.detalhe, err.status, err.mensagemGeral)
      }
      throw err
    }
  },

  recebedorUtilizavel: (id) => !!id && !isRecipientMock(id),

  async criarCobrancaSessao(input: CobrancaSessaoInput): Promise<CobrancaCriada> {
    const recipient = input.recebedor?.gateway === 'pagarme' ? input.recebedor.id : null
    if (input.metodo === 'pix') {
      if (!input.paciente.cpf) throw new Error('cpf_paciente_ausente')
      const o = await criarOrderPix({
        sessaoId: input.sessaoId, valorCentavos: input.valorCentavos,
        pacienteNome: input.paciente.nome, pacienteEmail: input.paciente.email,
        pacienteTelefone: input.paciente.telefone, pacienteDocumento: input.paciente.cpf,
        recipientPsicologo: recipient,
      })
      return {
        gateway: 'pagarme', cobrancaId: o.orderId, qrCode: o.qrCode ?? null, qrCodeUrl: o.qrCodeUrl ?? null,
        url: null, venceEm: o.expiresAt, taxaAdmCentavos: o.taxaAdmCentavos, parcelas: 1, metodo: 'pix',
      }
    }
    const o = await criarCheckoutCartao({
      sessaoId: input.sessaoId, valorCentavos: input.valorCentavos, metodo: input.metodo,
      pacienteNome: input.paciente.nome, pacienteEmail: input.paciente.email,
      recipientPsicologo: recipient,
    })
    return {
      gateway: 'pagarme', cobrancaId: o.orderId, url: o.checkoutUrl ?? null,
      venceEm: o.expiresAt, taxaAdmCentavos: o.taxaAdmCentavos,
      // O checkout da Pagar.me deixa o paciente escolher 1–6x; o número real vem no webhook.
      parcelas: 1, metodo: input.metodo,
    }
  },

  async reembolsar(input: ReembolsoInput): Promise<ReembolsoResultado> {
    const ok = await reembolsar(input.cobrancaId, input.valorCentavos)
    return ok ? { status: 'estornado' } : { status: 'falhou', motivo: 'pagarme_refund_failed' }
  },

  async criarAssinatura(input: AssinaturaInput): Promise<AssinaturaCriada> {
    const s = await criarAssinatura({
      plano: input.plano, ciclo: input.ciclo, cardToken: input.cardToken ?? 'mock_card_token', psicologo: input.psicologo,
    })
    return {
      gateway: 'pagarme', assinaturaId: s.subscriptionId,
      status: s.status === 'active' ? 'ativa' : 'falhou',
      proximaCobranca: s.proximaCobranca,
    }
  },

  cancelarAssinatura,
}
