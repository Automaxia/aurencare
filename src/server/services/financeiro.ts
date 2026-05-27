import 'server-only'
import { db } from '@/server/db/pool'

export type Cobranca = {
  id: string
  dataHora: string
  pacienteNome: string
  valor: number
  pagamentoStatus: string
  pagamentoMetodo: string | null
  pagarmeOrderId: string | null
  pagarmeCheckoutUrl: string | null
}

export type Financeiro = {
  cobrancas: Cobranca[]
  totaisMes: { recebido: number; pendente: number; reembolsado: number }
  valorMedioSessao: number
  ticketMedioMes: number
  inadimplenciaPct: number
}

export async function lerFinanceiro(psicologoId: string, mesIso: string): Promise<Financeiro> {
  const inicio = new Date(mesIso); inicio.setDate(1); inicio.setHours(0,0,0,0)
  const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59, 999)

  const { rows } = await db.query<any>(
    `SELECT s.id, s.data_hora, s.valor, s.pagamento_status, s.pagamento_metodo,
            s.pagarme_order_id, s.pagarme_checkout_url, p.nome AS paciente_nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1
        AND s.data_hora BETWEEN $2 AND $3
      ORDER BY s.data_hora DESC`,
    [psicologoId, inicio.toISOString(), fim.toISOString()],
  )

  const cobrancas: Cobranca[] = rows.map(r => ({
    id: r.id, dataHora: r.data_hora, pacienteNome: r.paciente_nome,
    valor: parseFloat(r.valor ?? 0),
    pagamentoStatus: r.pagamento_status, pagamentoMetodo: r.pagamento_metodo,
    pagarmeOrderId: r.pagarme_order_id, pagarmeCheckoutUrl: r.pagarme_checkout_url,
  }))

  const recebido     = cobrancas.filter(c => c.pagamentoStatus === 'pago').reduce((a, b) => a + b.valor, 0)
  const pendente     = cobrancas.filter(c => c.pagamentoStatus === 'pendente').reduce((a, b) => a + b.valor, 0)
  const reembolsado  = cobrancas.filter(c => c.pagamentoStatus === 'reembolsado').reduce((a, b) => a + b.valor, 0)

  const valoresPagos = cobrancas.filter(c => c.pagamentoStatus === 'pago').map(c => c.valor)
  const valorMedio = valoresPagos.length ? valoresPagos.reduce((a,b) => a + b, 0) / valoresPagos.length : 0
  const total = recebido + pendente
  const inad = total > 0 ? (pendente / total) * 100 : 0

  return {
    cobrancas,
    totaisMes: { recebido, pendente, reembolsado },
    valorMedioSessao: valorMedio,
    ticketMedioMes: valorMedio,
    inadimplenciaPct: inad,
  }
}

export type SaudePratica = {
  sessoesSemana: number
  sessoesMes: number
  taxaComparecimentoPct: number
  taxaCancelamentoPct: number
  ticketMedio: number
  retencaoPct: number
  pacientesAtivos: number
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

  const dentroSemana = s.filter(x => +new Date(x.data_hora) >= +inicioSem)
  const dentroMes    = s.filter(x => +new Date(x.data_hora) >= +inicioMes)
  const completas    = s.filter(x => x.status === 'concluida')
  const noShows      = s.filter(x => x.status === 'no_show')
  const cancelaram   = s.filter(x => x.status === 'cancelada')
  const passadas     = s.filter(x => +new Date(x.data_hora) < Date.now() && x.status !== 'agendada' && x.status !== 'aguardando_metodo' && x.status !== 'aguardando_pagamento' && x.status !== 'confirmada')

  const valoresPagos = s.filter(x => x.status === 'concluida').map(x => parseFloat(x.valor ?? 0))
  const ticket = valoresPagos.length ? valoresPagos.reduce((a,b) => a + b, 0) / valoresPagos.length : 0

  const taxaComp = passadas.length ? (completas.length / passadas.length) * 100 : 0
  const taxaCanc = passadas.length ? ((noShows.length + cancelaram.length) / passadas.length) * 100 : 0

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
    taxaComparecimentoPct: taxaComp,
    taxaCancelamentoPct: taxaCanc,
    ticketMedio: ticket,
    retencaoPct: ativos[0].n > 0 ? (ret[0].n / ativos[0].n) * 100 : 0,
    pacientesAtivos: ativos[0].n,
  }
}
