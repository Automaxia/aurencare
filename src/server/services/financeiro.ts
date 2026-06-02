import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Taxas estimadas Pagar.me (tabela padrão maio 2026).
 * Valores reais variam por contrato — usados como estimativa visual no painel.
 * Exibidos como "estimado" na UI; o líquido real chega via webhook.
 */
const TAXA_PIX        = 0.0099    // ~1%
const TAXA_DEBITO     = 0.0199    // ~2%
const TAXA_CREDITO_1X = 0.0399    // ~4%
const TAXA_CREDITO_PARC = 0.0499  // ~5% em parcelado

/**
 * Janela de liquidação (cai na conta) em dias úteis aproximados após pagamento.
 * Defaults Pagar.me: PIX D+1, débito D+2, crédito D+30.
 */
const LIQUIDACAO_DIAS: Record<string, number> = {
  pix: 1,
  debito: 2,
  credito: 30,
}

export type StatusConfirmacao = 'aguardando' | 'sim' | 'contestou' | 'silencio' | null
export type StatusNf = 'pendente' | 'emitida' | 'dispensada'

export type Cobranca = {
  id: string
  dataHora: string
  pacienteNome: string
  valor: number
  pagamentoStatus: string
  pagamentoMetodo: string | null
  pagamentoParcelas: number
  pagarmeOrderId: string | null
  pagarmeCheckoutUrl: string | null
  /** Taxa estimada da Pagar.me (centavos). 0 se ainda não pago. */
  taxaEstimada: number
  /** ETA de liquidação na conta da psicóloga (ISO). Null se ainda não pago. */
  caiEm: string | null
  /** Status da confirmação pós-sessão (Fluxo 7). */
  confirmacao: StatusConfirmacao
  /** Status da Nota Fiscal — pendente (default p/ pagas), emitida ou dispensada. */
  nfStatus: StatusNf
  /** Número da NF (texto livre informado pela psicóloga). */
  nfNumero: string | null
  /** Quando a NF foi marcada como emitida. */
  nfEmitidaEm: string | null
}

export type QuebraMetodo = {
  metodo: 'pix' | 'credito' | 'debito'
  total: number   // soma em R$
  count: number   // quantidade de cobranças
  pct: number     // % do total recebido
}

export type Financeiro = {
  cobrancas: Cobranca[]
  totaisMes: { recebido: number; pendente: number; reembolsado: number }
  /** Recebido bruto separado por método (período). */
  recebidoPorMetodo: { pix: number; credito: number; debito: number }
  /** Taxas Pagar.me estimadas no período. */
  taxasEstimadas: number
  /** Recebido líquido estimado (bruto - taxas) — chega na conta. */
  liquidoEstimado: number
  /** Total pago mas ainda em janela de liquidação (cai nos próximos N dias). */
  aReceber30d: number
  /** % de cada método no recebido — pra barra visual. */
  quebraMetodo: QuebraMetodo[]
  valorMedioSessao: number
  ticketMedioMes: number
  inadimplenciaPct: number
}

export type Periodo = 'mes' | '30d' | '90d' | 'ano'

export function rangeDoPeriodo(periodo: Periodo, anchor: Date = new Date()): { inicio: Date; fim: Date } {
  const fim = new Date(anchor); fim.setHours(23, 59, 59, 999)
  if (periodo === '30d') {
    const inicio = new Date(anchor); inicio.setDate(anchor.getDate() - 30); inicio.setHours(0, 0, 0, 0)
    return { inicio, fim }
  }
  if (periodo === '90d') {
    const inicio = new Date(anchor); inicio.setDate(anchor.getDate() - 90); inicio.setHours(0, 0, 0, 0)
    return { inicio, fim }
  }
  if (periodo === 'ano') {
    const inicio = new Date(anchor.getFullYear(), 0, 1)
    return { inicio, fim }
  }
  // mes (default)
  const inicio = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const fimMes = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999)
  return { inicio, fim: fimMes }
}

export async function lerFinanceiro(
  psicologoId: string,
  anchorIso: string,
  periodo: Periodo = 'mes',
): Promise<Financeiro> {
  const { inicio, fim } = rangeDoPeriodo(periodo, new Date(anchorIso))
  const agora = new Date(anchorIso)

  const { rows } = await db.query<any>(
    `SELECT s.id, s.data_hora, s.valor, s.pagamento_status, s.pagamento_metodo,
            s.pagamento_parcelas, s.pagarme_order_id, s.pagarme_checkout_url,
            s.pago_em,
            s.confirmacao_resposta, s.confirmacao_janela_expira_em,
            s.confirmacao_enviada_em,
            s.nf_status, s.nf_numero, s.nf_emitida_em,
            p.nome AS paciente_nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1
        AND s.data_hora BETWEEN $2 AND $3
      ORDER BY s.data_hora DESC`,
    [psicologoId, inicio.toISOString(), fim.toISOString()],
  )

  const cobrancas: Cobranca[] = rows.map(r => {
    const valor = parseFloat(r.valor ?? 0)
    const metodo = r.pagamento_metodo as string | null
    const parcelas = parseInt(r.pagamento_parcelas ?? 1, 10) || 1
    const pago = r.pagamento_status === 'pago'
    // pago_em real do webhook tem prioridade; fallback é a data da sessão.
    const baseLiquidacao = r.pago_em ? new Date(r.pago_em) : new Date(r.data_hora)
    return {
      id: r.id,
      dataHora: r.data_hora,
      pacienteNome: r.paciente_nome,
      valor,
      pagamentoStatus: r.pagamento_status,
      pagamentoMetodo: metodo,
      pagamentoParcelas: parcelas,
      pagarmeOrderId: r.pagarme_order_id,
      pagarmeCheckoutUrl: r.pagarme_checkout_url,
      taxaEstimada: pago ? Math.round(valor * taxaDe(metodo, parcelas) * 100) / 100 : 0,
      caiEm: pago ? prevLiquidacao(baseLiquidacao, metodo) : null,
      confirmacao: classificarConfirmacao(r, agora),
      nfStatus: classificarNf(r, pago),
      nfNumero: r.nf_numero,
      nfEmitidaEm: r.nf_emitida_em,
    }
  })

  const pagas = cobrancas.filter(c => c.pagamentoStatus === 'pago')
  const recebido    = pagas.reduce((a, b) => a + b.valor, 0)
  const pendente    = cobrancas.filter(c => c.pagamentoStatus === 'pendente').reduce((a, b) => a + b.valor, 0)
  const reembolsado = cobrancas.filter(c => c.pagamentoStatus === 'reembolsado').reduce((a, b) => a + b.valor, 0)

  const recebidoPorMetodo = {
    pix:     pagas.filter(c => c.pagamentoMetodo === 'pix').reduce((a, b) => a + b.valor, 0),
    credito: pagas.filter(c => c.pagamentoMetodo === 'credito').reduce((a, b) => a + b.valor, 0),
    debito:  pagas.filter(c => c.pagamentoMetodo === 'debito').reduce((a, b) => a + b.valor, 0),
  }

  const taxasEstimadas  = pagas.reduce((a, b) => a + b.taxaEstimada, 0)
  const liquidoEstimado = recebido - taxasEstimadas

  // A receber: cobranças pagas com caiEm no futuro
  const aReceber30d = pagas
    .filter(c => c.caiEm && new Date(c.caiEm) > agora)
    .reduce((a, b) => a + (b.valor - b.taxaEstimada), 0)

  const quebraMetodo: QuebraMetodo[] = (['pix', 'credito', 'debito'] as const).map(m => {
    const cobs = pagas.filter(c => c.pagamentoMetodo === m)
    const total = cobs.reduce((a, b) => a + b.valor, 0)
    return {
      metodo: m,
      total,
      count: cobs.length,
      pct: recebido > 0 ? (total / recebido) * 100 : 0,
    }
  }).filter(q => q.count > 0)

  const valorMedio = pagas.length ? recebido / pagas.length : 0
  const total = recebido + pendente
  const inad = total > 0 ? (pendente / total) * 100 : 0

  return {
    cobrancas,
    totaisMes: { recebido, pendente, reembolsado },
    recebidoPorMetodo,
    taxasEstimadas,
    liquidoEstimado,
    aReceber30d,
    quebraMetodo,
    valorMedioSessao: valorMedio,
    ticketMedioMes: valorMedio,
    inadimplenciaPct: inad,
  }
}

/**
 * Taxa estimada Pagar.me. PIX/débito não têm parcelas — crédito 2+ vezes
 * cai na faixa "parcelado".
 */
function taxaDe(metodo: string | null, parcelas: number): number {
  if (metodo === 'pix') return TAXA_PIX
  if (metodo === 'debito') return TAXA_DEBITO
  if (metodo === 'credito') return parcelas > 1 ? TAXA_CREDITO_PARC : TAXA_CREDITO_1X
  return 0
}

/**
 * Previsão de liquidação (ISO). Recebe pago_em real do webhook quando
 * disponível; em sessões antigas (antes da migration 009) cai pra data_hora.
 */
function prevLiquidacao(quandoPaga: Date, metodo: string | null): string {
  const dias = LIQUIDACAO_DIAS[metodo ?? ''] ?? 1
  const d = new Date(quandoPaga)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

function classificarConfirmacao(r: any, agora: Date): StatusConfirmacao {
  const resp = r.confirmacao_resposta as string | null
  if (resp === 'sim' || resp === 'contestou' || resp === 'silencio') return resp
  if (r.confirmacao_enviada_em && r.confirmacao_janela_expira_em) {
    return new Date(r.confirmacao_janela_expira_em) > agora ? 'aguardando' : 'silencio'
  }
  return null
}

/**
 * Status da NF na visão do front:
 *  · emitida    — psi marcou explicitamente
 *  · dispensada — psi marcou que não emite
 *  · pendente   — pago mas ainda não marcado
 *  Cobranças não pagas devolvem 'pendente' por default; a UI escolhe esconder.
 */
function classificarNf(r: any, pago: boolean): StatusNf {
  const v = r.nf_status as string | null
  if (v === 'emitida' || v === 'dispensada') return v
  if (pago) return 'pendente'
  return 'pendente'
}

export type SaudePratica = {
  sessoesSemana: number
  sessoesMes: number
  /** Sessões que deveriam ter acontecido (data passada, não-pendente). */
  sessoesPassadas90d: number
  /** Sessões que de fato aconteceram (status concluida). */
  sessoesConcluidas90d: number
  noShows90d: number
  cancelamentos90d: number
  /** concluidas / passadas. 0..100 */
  taxaComparecimentoPct: number
  /** (no_show + cancelada) / passadas. 0..100 */
  taxaCancelamentoPct: number
  ticketMedio: number
  retencaoPct: number
  pacientesAtivos: number
  pacientesComRecente30d: number
}

export async function lerSaude(psicologoId: string): Promise<SaudePratica> {
  const hoje = new Date()
  const inicioSem = new Date(hoje); inicioSem.setDate(hoje.getDate() - hoje.getDay()); inicioSem.setHours(0,0,0,0)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const inicio90  = new Date(); inicio90.setDate(inicio90.getDate() - 90)

  const { rows: s } = await db.query<{ status: string; valor: any; data_hora: string }>(
    `SELECT status, valor, data_hora FROM sessoes
      WHERE psicologo_id = $1 AND data_hora >= $2`, [psicologoId, inicio90.toISOString()],
  )

  const agora = Date.now()
  const dentroSemana = s.filter(x => +new Date(x.data_hora) >= +inicioSem)
  const dentroMes    = s.filter(x => +new Date(x.data_hora) >= +inicioMes)

  // ── Universo "que deveria ter acontecido" — apenas sessões cuja DATA já passou ──
  const passadas = s.filter(x => +new Date(x.data_hora) < agora)

  // Concluídas/falhas só dentro do universo de passadas (numerador <= denominador sempre)
  const concluidas = passadas.filter(x => x.status === 'concluida')
  const noShows    = passadas.filter(x => x.status === 'no_show')
  const cancelaram = passadas.filter(x => x.status === 'cancelada')

  // Sessões que ainda estavam aguardando método/pagamento na data — não contam como "deveriam acontecer"
  const passadasElegiveis = passadas.filter(x =>
    x.status !== 'aguardando_metodo' && x.status !== 'aguardando_pagamento',
  )

  const taxaComp = passadasElegiveis.length
    ? Math.min(100, (concluidas.length / passadasElegiveis.length) * 100)
    : 0
  const taxaCanc = passadasElegiveis.length
    ? Math.min(100, ((noShows.length + cancelaram.length) / passadasElegiveis.length) * 100)
    : 0

  // Ticket médio = média do valor das sessões concluídas (no universo passado)
  const valoresConcluidas = concluidas.map(x => parseFloat(x.valor ?? 0))
  const ticket = valoresConcluidas.length
    ? valoresConcluidas.reduce((a, b) => a + b, 0) / valoresConcluidas.length
    : 0

  const { rows: ativos } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pacientes WHERE psicologo_id = $1 AND status = 'ativo'`, [psicologoId])

  // Retenção: % de pacientes ativos com sessão nos últimos 30 dias.
  const { rows: ret } = await db.query<{ n: number }>(
    `SELECT COUNT(DISTINCT s.paciente_id)::int AS n
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE p.psicologo_id = $1 AND p.status = 'ativo'
        AND s.data_hora >= NOW() - INTERVAL '30 days'`, [psicologoId])

  return {
    sessoesSemana: dentroSemana.length,
    sessoesMes: dentroMes.length,
    sessoesPassadas90d: passadasElegiveis.length,
    sessoesConcluidas90d: concluidas.length,
    noShows90d: noShows.length,
    cancelamentos90d: cancelaram.length,
    taxaComparecimentoPct: taxaComp,
    taxaCancelamentoPct: taxaCanc,
    ticketMedio: ticket,
    retencaoPct: ativos[0].n > 0 ? Math.min(100, (ret[0].n / ativos[0].n) * 100) : 0,
    pacientesAtivos: ativos[0].n,
    pacientesComRecente30d: ret[0].n,
  }
}
