import 'server-only'
/**
 * Subconta Asaas do psicólogo (recebedor do split). docs/asaas/sdd.md §4.1,
 * spike.md §1–2.
 */
import { env } from '../../env'
import { log } from '../../log'
import { asaas, AsaasErro, ambienteAsaas } from './cliente'
import { RecebedorErro, type RecebedorInput, type RecebedorCriado, type SituacaoRecebedor } from '../tipos'
import { situacaoDeStatus, type StatusConta } from './situacao'
export { situacaoDeStatus }

/** Eventos de situação cadastral que a subconta manda para o nosso webhook. */
export const EVENTOS_CONTA = [
  'BANK_ACCOUNT_INFO', 'COMMERCIAL_INFO', 'DOCUMENT', 'GENERAL_APPROVAL',
].flatMap(d => ['APPROVED', 'AWAITING_APPROVAL', 'PENDING', 'REJECTED'].map(s => `ACCOUNT_STATUS_${d}_${s}`))

/** Config de webhook da subconta, se dá para receber (URL https + token). */
function webhooksSubconta(emailContato: string) {
  const url = `${env.appUrl.replace(/\/$/, '')}/api/webhooks/asaas`
  if (!env.asaasWebhookToken || !url.startsWith('https://')) return undefined
  return [{
    name: 'Audere — situação da conta', url, email: env.adminAlertEmail || emailContato, // obrigatório: o Asaas avisa por aqui se a fila travar
    enabled: true, interrupted: false, apiVersion: 3, sendType: 'SEQUENTIALLY',
    authToken: env.asaasWebhookToken, events: EVENTOS_CONTA,
  }]
}

export async function criarSubconta(input: RecebedorInput): Promise<RecebedorCriado> {
  const doc = input.documento.replace(/\D/g, '')

  // Idempotência: uma 2ª tentativa (timeout, gravação falhou) não pode criar outra
  // subconta — o Asaas recusa o documento repetido ("já está em uso"), então
  // reaproveitamos a existente. A apiKey não volta (só vem na criação), mas o
  // walletId basta para o split.
  const existente = await buscarPorDocumento(doc)
  if (existente) {
    log.warn('asaas.recebedor', `subconta já existia para o documento (${existente.id}) — reaproveitando sem apiKey`)
    return existente
  }

  const tel = input.telefone.replace(/\D/g, '')
  const corpo: Record<string, unknown> = {
    name: input.razaoSocial.trim(),
    email: input.email,
    cpfCnpj: doc,
    mobilePhone: tel,
    incomeValue: Math.round(input.rendaCentavos) / 100,
    address: input.endereco.logradouro.trim(),
    addressNumber: input.endereco.numero.trim() || 'S/N',
    complement: input.endereco.complemento?.trim() || undefined,
    province: input.endereco.bairro.trim(),
    postalCode: input.endereco.cep.replace(/\D/g, ''),
    ...(input.tipoPessoa === 'PF'
      ? { birthDate: input.dataNascimento }
      : { companyType: input.tipoEmpresa ?? 'LIMITED' }),
  }
  const wh = webhooksSubconta(input.email)
  if (wh) corpo.webhooks = wh
  else log.warn('asaas.recebedor', 'subconta sem webhook (ASAAS_WEBHOOK_TOKEN ou URL https ausente) — situação só pela reconciliação')

  try {
    const r = await asaas('POST', '/accounts', corpo, { rotulo: 'criar subconta' })
    const apiKey: string | null = r?.apiKey ?? r?.accessToken?.apiKey ?? null
    if (!apiKey) log.err('asaas.recebedor', `subconta ${r?.id} criada SEM apiKey na resposta`, undefined)
    log.ok('asaas.recebedor', `subconta ${r.id} criada (wallet ${r.walletId})`)
    return {
      gateway: 'asaas', ambiente: ambienteAsaas(), id: r.id, walletId: r.walletId ?? null, apiKey,
      // Situação real chega por webhook; a criação sempre começa pendente.
      situacao: 'pendente',
    }
  } catch (err) {
    if (err instanceof AsaasErro) {
      // Corrida: outra tentativa criou entre a busca e o POST.
      if (err.tem(/já está em uso/i)) {
        const agora = await buscarPorDocumento(doc)
        if (agora) return agora
      }
      throw new RecebedorErro(
        'asaas',
        err.erros.map(e => ({ caminho: e.code, mensagens: [e.description] })),
        err.corpo, err.status, err.descricao,
      )
    }
    throw err
  }
}

async function buscarPorDocumento(doc: string): Promise<RecebedorCriado | null> {
  const r = await asaas('GET', `/accounts?cpfCnpj=${doc}&limit=1`)
  const c = r?.data?.[0]
  if (!c) return null
  return {
    gateway: 'asaas', ambiente: ambienteAsaas(), id: c.id, walletId: c.walletId ?? null,
    apiKey: null, situacao: 'pendente', reaproveitado: true,
  }
}

/** Situação atual (reconciliação). Precisa da apiKey DA SUBCONTA. */
export async function lerSituacao(apiKey: string): Promise<{ situacao: SituacaoRecebedor; detalhe: StatusConta }> {
  const st = await asaas<StatusConta>('GET', '/myAccount/status', undefined, { chave: apiKey })
  return { situacao: situacaoDeStatus(st), detalhe: st }
}
