import 'server-only'
/**
 * Adaptador Asaas → `GatewayPagamento`. sdd §4.
 *
 * Modo mock (RF-PG-04): sem `ASAAS_API_KEY` configurada, devolve ids
 * `mock_asaas_*` e URLs da rota `/mock/...` — o mesmo sinal de mock de sempre
 * (prefixo `mock_`).
 */
import { env, integrationStatus } from '../../env'
import { log } from '../../log'
import { taxaAdmCentavos } from '../split'
import { ambienteAsaas } from './cliente'
import { criarSubconta } from './recebedor'
import { criarCobrancaAsaas, reembolsarAsaas, cancelarCobrancaAsaas } from './cobranca'
import {
  criarAssinaturaAsaas, atualizarAssinaturaAsaas, cancelarAssinaturaAsaas,
  faturaEmAbertoAsaas, proximaCobrancaAsaas,
} from './assinatura'
import type { GatewayPagamento } from '../tipos'

/**
 * Em produção, Asaas como gateway padrão SEM chave é erro de configuração (ex.:
 * "$aact_" expandido para vazio num .env) — falha alto em vez de criar subconta
 * e cobrança `mock_` que ninguém percebe. Fora de produção, mock como sempre.
 */
const mock = () => {
  if (integrationStatus.asaas) return false
  if (process.env.NODE_ENV === 'production' && env.paymentGateway === 'asaas') {
    log.err('asaas', 'PAYMENT_GATEWAY=asaas em produção sem ASAAS_API_KEY — recusando modo mock')
    throw new Error('asaas_nao_configurado')
  }
  return true
}
const mockId = (tipo: string, base: string) => `mock_asaas_${tipo}_${base.replace(/\W/g, '').slice(0, 8)}_${Date.now().toString(36)}`

export const asaasGateway: GatewayPagamento = {
  nome: 'asaas',
  ambiente: ambienteAsaas,
  configurado: () => integrationStatus.asaas,

  async criarRecebedor(input) {
    if (mock()) {
      const id = mockId('acc', input.documento)
      log.warn('asaas', `[mock] subconta ${id} (${input.tipoPessoa} ${input.razaoSocial})`)
      return { gateway: 'asaas', ambiente: 'sandbox', id, walletId: `mock_asaas_wallet_${id.slice(-6)}`, apiKey: null, situacao: 'pendente' }
    }
    return criarSubconta(input)
  },

  recebedorUtilizavel: (id) => !!id && !id.startsWith('mock_'),

  async criarCobrancaSessao(input) {
    if (mock()) {
      const pix = input.metodo === 'pix'
      const id = mockId(pix ? 'pix' : 'cc', input.sessaoId)
      log.warn('asaas', `[mock] cobrança ${id} valor=${input.valorCentavos}`)
      return {
        gateway: 'asaas', cobrancaId: id,
        qrCode: pix ? '00020126...mock-br-code...' : null,
        qrCodeUrl: pix ? `${env.appUrl}/mock/qr/${id}.png` : null,
        url: pix ? null : `${env.appUrl}/mock/checkout/${id}`,
        venceEm: new Date(Date.now() + (pix ? 30 * 60_000 : 2 * 3600_000)).toISOString(),
        taxaAdmCentavos: input.recebedor ? taxaAdmCentavos(input.valorCentavos) : 0,
        parcelas: input.metodo === 'credito' ? Math.min(6, Math.max(1, input.parcelas ?? 1)) : 1,
        metodo: input.metodo === 'debito' ? 'credito' : input.metodo,
      }
    }
    return criarCobrancaAsaas(input)
  },

  async reembolsar(input) {
    if (input.cobrancaId.startsWith('mock_')) { log.warn('asaas', `[mock] estorno de ${input.cobrancaId}`); return { status: 'estornado' } }
    return reembolsarAsaas(input)
  },

  async cancelarCobranca(id) {
    if (id.startsWith('mock_')) { log.warn('asaas', `[mock] cancelamento de cobrança ${id}`); return true }
    return cancelarCobrancaAsaas(id)
  },

  async criarAssinatura(input) {
    if (mock()) {
      const id = mockId('sub', input.psicologo.id)
      log.warn('asaas', `[mock] assinatura ${id} ${input.plano}/${input.ciclo}`)
      // Mock não tem fatura para pagar: nasce ativa, como o mock da Pagar.me.
      return { gateway: 'asaas', assinaturaId: id, status: 'ativa', proximaCobranca: null, urlPagamento: null }
    }
    return criarAssinaturaAsaas(input)
  },

  async atualizarAssinatura(id, input, acrescimo) {
    if (id.startsWith('mock_')) return { ok: true, vencimento: null, urlPagamento: null }
    return atualizarAssinaturaAsaas(id, input, acrescimo)
  },

  async cancelarAssinatura(id) {
    if (id.startsWith('mock_')) { log.warn('asaas', `[mock] cancelamento de ${id}`); return true }
    return cancelarAssinaturaAsaas(id)
  },

  async faturaEmAberto(id) {
    if (id.startsWith('mock_')) return null
    return faturaEmAbertoAsaas(id)
  },

  async proximaCobranca(id) {
    if (id.startsWith('mock_')) return null
    return proximaCobrancaAsaas(id)
  },
}
