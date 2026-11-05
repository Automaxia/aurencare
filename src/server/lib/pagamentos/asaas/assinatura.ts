import 'server-only'
/**
 * Assinatura do plano no Asaas (D-04: sem cartão na Audere). sdd §4.5, spike §6.
 *
 * Cria a assinatura `CREDIT_CARD` SEM cartão → a 1ª cobrança nasce na hora com
 * `invoiceUrl` → o psicólogo paga na fatura do Asaas → o Asaas guarda o cartão
 * e as renovações já nascem com ele. O plano só fica ativo no webhook da 1ª
 * cobrança paga.
 */
import { log } from '../../log'
import { PLANOS, precoCentavos } from '../../planos'
import { asaas, AsaasErro } from './cliente'
import { garantirCustomer } from './cobranca'
import { paraReais } from '../split'
import { refPsicologo } from './ref'
import type { AssinaturaInput, AssinaturaCriada, AtualizacaoAssinatura } from '../tipos'

const CICLO = { mensal: 'MONTHLY', anual: 'YEARLY' } as const


function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export async function criarAssinaturaAsaas(input: AssinaturaInput): Promise<AssinaturaCriada> {
  const customer = await garantirCustomer({
    ref: refPsicologo(input.psicologo.id), nome: input.psicologo.nome,
    cpfCnpj: input.psicologo.documento, email: input.psicologo.email, comContato: true,
  }).catch(err => {
    if ((err as Error).message === 'cpf_paciente_ausente') throw new Error('documento_assinante_ausente')
    throw err
  })

  const sub = await asaas('POST', '/subscriptions', {
    customer,
    billingType: 'CREDIT_CARD',
    value: paraReais(precoCentavos(input.plano, input.ciclo)),
    cycle: CICLO[input.ciclo],
    nextDueDate: hojeSP(),
    description: `Audere ${PLANOS[input.plano].nome} (${input.ciclo})`,
    externalReference: refPsicologo(input.psicologo.id),
  })

  const cobs = await asaas('GET', `/subscriptions/${sub.id}/payments?limit=1`)
  const primeira = cobs?.data?.[0]
  if (!primeira?.invoiceUrl) log.err('asaas.assinatura', `assinatura ${sub.id} sem fatura da 1ª cobrança`, undefined)
  log.ok('asaas.assinatura', `assinatura ${sub.id} criada (${input.plano}/${input.ciclo}) — aguardando pagamento da fatura`)
  return {
    gateway: 'asaas', assinaturaId: sub.id, status: 'aguardando_pagamento',
    proximaCobranca: sub.nextDueDate ?? null, urlPagamento: primeira?.invoiceUrl ?? null,
  }
}

/**
 * Troca de plano sem perder o cartão guardado. Valor/ciclo novos valem para a
 * próxima cobrança — que o Asaas costuma já ter gerado (PENDING). Essa
 * cobrança é ajustada à mão para: preço novo + acréscimos já somados nela
 * (diferença de um upgrade anterior no mesmo ciclo) + `acrescimoCentavos`.
 * Sem cobrança gerada ainda (ciclo anual, p.ex.) e com acréscimo, abre uma
 * fatura avulsa da diferença e devolve o link.
 */
export async function atualizarAssinaturaAsaas(
  assinaturaId: string, input: AssinaturaInput, acrescimoCentavos = 0,
): Promise<AtualizacaoAssinatura> {
  try {
    const sub = await asaas('GET', `/subscriptions/${assinaturaId}`)
    const precoNovo = precoCentavos(input.plano, input.ciclo)
    const descricao = `Audere ${PLANOS[input.plano].nome} (${input.ciclo})`
    const pend = await proximaPendente(assinaturaId)

    await asaas('PUT', `/subscriptions/${assinaturaId}`, {
      value: paraReais(precoNovo),
      cycle: CICLO[input.ciclo],
      description: descricao,
      // A pendente é ajustada abaixo, preservando acréscimos já somados nela.
      updatePendingPayments: false,
    })

    if (pend) {
      const jaSomado = Math.max(0, Math.round(Number(pend.value) * 100) - Math.round(Number(sub.value) * 100))
      const total = precoNovo + jaSomado + acrescimoCentavos
      if (total !== Math.round(Number(pend.value) * 100)) {
        await asaas('PUT', `/payments/${pend.id}`, {
          billingType: pend.billingType, dueDate: pend.dueDate, value: paraReais(total),
          description: jaSomado + acrescimoCentavos > 0 ? `${descricao} + diferença proporcional da troca de plano` : descricao,
        })
      }
      log.ok('asaas.assinatura', `assinatura ${assinaturaId} → ${input.plano}/${input.ciclo}; cobrança ${pend.id} (${pend.dueDate}) = ${total}c`)
      return { ok: true, vencimento: pend.dueDate, urlPagamento: null }
    }

    if (acrescimoCentavos > 0) {
      const avulsa = await asaas('POST', '/payments', {
        customer: sub.customer, billingType: 'UNDEFINED', value: paraReais(acrescimoCentavos),
        dueDate: hojeSP(), description: `Audere — diferença proporcional da troca para o ${PLANOS[input.plano].nome}`,
        externalReference: `${refPsicologo(input.psicologo.id)}:troca`,
      })
      log.warn('asaas.assinatura', `assinatura ${assinaturaId} sem cobrança pendente — diferença em fatura avulsa ${avulsa.id}`)
      return { ok: true, vencimento: sub.nextDueDate ?? null, urlPagamento: avulsa.invoiceUrl ?? null }
    }
    return { ok: true, vencimento: sub.nextDueDate ?? null, urlPagamento: null }
  } catch (err) {
    log.err('asaas.assinatura', `falha ao atualizar ${assinaturaId}`, err instanceof Error ? err.message : err)
    return { ok: false }
  }
}

export async function proximaCobrancaGeradaAsaas(assinaturaId: string): Promise<boolean> {
  try {
    return !!(await proximaPendente(assinaturaId))
  } catch (err) {
    // Na dúvida, diz que sim: a prévia promete "na próxima fatura", que é o caso comum.
    log.warn('asaas.assinatura', `sem leitura das cobranças de ${assinaturaId}: ${err instanceof Error ? err.message : err}`)
    return true
  }
}

/** Cobrança PENDING mais próxima (de hoje em diante) da assinatura. */
async function proximaPendente(assinaturaId: string): Promise<any | null> {
  const hoje = hojeSP()
  const r = await asaas('GET', `/subscriptions/${assinaturaId}/payments?limit=20`)
  return (r?.data ?? [])
    .filter((c: any) => c.status === 'PENDING' && String(c.dueDate) >= hoje)
    .sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] ?? null
}

/** Fatura em aberto (PENDING/OVERDUE) mais antiga da assinatura — é ela que destrava o plano. */
export async function faturaEmAbertoAsaas(assinaturaId: string): Promise<string | null> {
  try {
    const r = await asaas('GET', `/subscriptions/${assinaturaId}/payments?limit=20`)
    const abertas = (r?.data ?? [])
      .filter((c: any) => c.status === 'PENDING' || c.status === 'OVERDUE')
      .sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)))
    return abertas[0]?.invoiceUrl ?? null
  } catch (err) {
    log.err('asaas.assinatura', `falha ao buscar fatura de ${assinaturaId}`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Vencimento da próxima cobrança. O Asaas gera a cobrança seguinte com
 * antecedência (PENDING) e, a partir daí, `nextDueDate` da assinatura já aponta
 * para a de DEPOIS (visto no sandbox: paga a de 04/11, existe a de 04/12 PENDING
 * e nextDueDate = 04/01). Por isso vale a cobrança em aberto mais próxima e só
 * na falta dela o `nextDueDate`.
 */
export async function proximaCobrancaAsaas(assinaturaId: string): Promise<string | null> {
  try {
    const futura = (await proximaPendente(assinaturaId))?.dueDate as string | undefined
    if (futura) return futura
    const sub = await asaas('GET', `/subscriptions/${assinaturaId}`)
    return typeof sub?.nextDueDate === 'string' ? sub.nextDueDate : null
  } catch (err) {
    log.warn('asaas.assinatura', `sem próxima cobrança de ${assinaturaId}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export async function cancelarAssinaturaAsaas(assinaturaId: string): Promise<boolean> {
  try {
    await asaas('DELETE', `/subscriptions/${assinaturaId}`)
    log.ok('asaas.assinatura', `assinatura ${assinaturaId} cancelada`)
    return true
  } catch (err) {
    // Já removida: o objetivo (não cobrar mais) está cumprido.
    if (err instanceof AsaasErro && err.status === 404) return true
    log.err('asaas.assinatura', `falha ao cancelar ${assinaturaId}`, err instanceof Error ? err.message : err)
    return false
  }
}
