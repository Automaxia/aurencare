import 'server-only'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { criarOrderPix, criarCheckoutCartao, reembolsar } from '@/server/lib/pagarme'
import { publish } from '@/server/lib/sse'
import { encrypt, decrypt, tryDecrypt } from '@/server/lib/crypto'
import { log } from '@/server/lib/log'
import { formatDateTimeBR } from '@/lib/formatters'

export type SessaoStatus =
  | 'agendada' | 'aguardando_metodo' | 'aguardando_pagamento'
  | 'confirmada' | 'em_curso' | 'concluida' | 'cancelada' | 'no_show'

export type Sessao = {
  id: string
  psicologoId: string
  pacienteId: string
  pacienteNome: string
  pacienteTelefone: string
  pacienteEmail: string | null
  numero: number
  dataHora: string
  duracaoMin: number
  modalidade: string
  status: SessaoStatus
  pagamentoStatus: 'pendente' | 'pago' | 'reembolsado' | 'falhou'
  pagamentoMetodo: 'pix' | 'credito' | 'debito' | null
  pagamentoParcelas: number
  pagarmeOrderId: string | null
  pagarmeQrcode: string | null
  pagarmeQrcodeUrl: string | null
  pagarmeCheckoutUrl: string | null
  valor: number
  assinada: boolean
  assinaturaTimestamp: string | null
  resumoIa: string | null
  transcricao: string | null
  notaClinica: string | null
}

function rowToSessao(r: any): Sessao {
  return {
    id: r.id, psicologoId: r.psicologo_id, pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome, pacienteTelefone: r.paciente_telefone, pacienteEmail: r.paciente_email,
    numero: r.numero, dataHora: r.data_hora, duracaoMin: r.duracao_min, modalidade: r.modalidade,
    status: r.status, pagamentoStatus: r.pagamento_status, pagamentoMetodo: r.pagamento_metodo,
    pagamentoParcelas: r.pagamento_parcelas,
    pagarmeOrderId: r.pagarme_order_id, pagarmeQrcode: r.pagarme_qrcode,
    pagarmeQrcodeUrl: r.pagarme_qrcode_url, pagarmeCheckoutUrl: r.pagarme_checkout_url,
    valor: parseFloat(r.valor),
    assinada: r.assinada, assinaturaTimestamp: r.assinatura_timestamp,
    resumoIa: tryDecrypt(r.resumo_ia),
    transcricao: tryDecrypt(r.transcricao_texto),
    notaClinica: tryDecrypt(r.nota_clinica),
  }
}

const SELECT_SESSAO_BASE = `
  SELECT s.*,
         p.nome AS paciente_nome,
         p.telefone AS paciente_telefone,
         p.email AS paciente_email
    FROM sessoes s
    JOIN pacientes p ON p.id = s.paciente_id
`

export async function buscarSessao(id: string): Promise<Sessao | null> {
  const { rows } = await db.query(`${SELECT_SESSAO_BASE} WHERE s.id = $1 LIMIT 1`, [id])
  return rows[0] ? rowToSessao(rows[0]) : null
}

export async function listarSessoesEntre(psicologoId: string, inicioIso: string, fimIso: string): Promise<Sessao[]> {
  const { rows } = await db.query(
    `${SELECT_SESSAO_BASE}
      WHERE s.psicologo_id = $1
        AND s.data_hora >= $2 AND s.data_hora <= $3
      ORDER BY s.data_hora ASC`,
    [psicologoId, inicioIso, fimIso],
  )
  return rows.map(rowToSessao)
}

export async function proximaSessao(psicologoId: string): Promise<Sessao | null> {
  const { rows } = await db.query(
    `${SELECT_SESSAO_BASE}
      WHERE s.psicologo_id = $1
        AND s.data_hora >= NOW()
        AND s.status NOT IN ('cancelada','concluida')
      ORDER BY s.data_hora ASC
      LIMIT 1`,
    [psicologoId],
  )
  return rows[0] ? rowToSessao(rows[0]) : null
}

export async function sessoesPendentesAssinatura(psicologoId: string): Promise<Sessao[]> {
  const { rows } = await db.query(
    `${SELECT_SESSAO_BASE}
      WHERE s.psicologo_id = $1 AND s.status = 'concluida' AND s.assinada = FALSE
      ORDER BY s.data_hora DESC
      LIMIT 6`,
    [psicologoId],
  )
  return rows.map(rowToSessao)
}

// ── Criação de sessão ─────────────────────────────────────────────────────
export type CriarSessaoInput = {
  psicologoId: string
  pacienteId: string
  dataHora: string
  duracaoMin?: number
  modalidade?: string
  valor: number
}

export async function criarSessao(input: CriarSessaoInput): Promise<Sessao> {
  // calcula próximo número da sessão para esse paciente
  const { rows: count } = await db.query<{ n: number }>(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS n
       FROM sessoes WHERE paciente_id = $1`,
    [input.pacienteId],
  )
  const numero = count[0].n

  const { rows } = await db.query(
    `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade, status, valor)
     VALUES ($1,$2,$3,$4,$5,$6,'aguardando_metodo',$7)
     RETURNING id`,
    [input.psicologoId, input.pacienteId, numero, input.dataHora, input.duracaoMin ?? 50, input.modalidade ?? 'online', input.valor],
  )
  const sessao = (await buscarSessao(rows[0].id))!

  // Fluxo 2 — pergunta método via WhatsApp.
  await enviarWA(
    sessao.pacienteTelefone,
    WA_TEMPLATES.fluxo2_perguntarMetodo(formatDateTimeBR(sessao.dataHora), sessao.valor),
  )

  return sessao
}

// ── Métodos de pagamento (Pagar.me) ───────────────────────────────────────
export async function gerarCobrancaPix(sessaoId: string): Promise<Sessao> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')

  const order = await criarOrderPix({
    sessaoId: s.id,
    valorCentavos: Math.round(s.valor * 100),
    pacienteNome: s.pacienteNome,
    pacienteEmail: s.pacienteEmail,
    pacienteTelefone: s.pacienteTelefone,
  })

  await db.query(
    `UPDATE sessoes
        SET status='aguardando_pagamento', pagamento_metodo='pix', pagamento_parcelas=1,
            pagarme_order_id=$2, pagarme_qrcode=$3, pagarme_qrcode_url=$4,
            wa_metodo_escolhido=TRUE
      WHERE id=$1`,
    [s.id, order.orderId, order.qrCode ?? null, order.qrCodeUrl ?? null],
  )

  await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo2_pix(order.qrCodeUrl ?? order.qrCode ?? '', s.valor))
  return (await buscarSessao(s.id))!
}

export async function gerarCobrancaCartao(sessaoId: string, metodo: 'credito' | 'debito'): Promise<Sessao> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')

  const order = await criarCheckoutCartao({
    sessaoId: s.id,
    valorCentavos: Math.round(s.valor * 100),
    metodo,
    pacienteNome: s.pacienteNome,
    pacienteEmail: s.pacienteEmail,
  })

  await db.query(
    `UPDATE sessoes
        SET status='aguardando_pagamento', pagamento_metodo=$2,
            pagarme_order_id=$3, pagarme_checkout_url=$4,
            wa_metodo_escolhido=TRUE
      WHERE id=$1`,
    [s.id, metodo, order.orderId, order.checkoutUrl ?? null],
  )

  await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo2_checkout(order.checkoutUrl ?? '', metodo, s.valor))
  return (await buscarSessao(s.id))!
}

// ── Webhook handlers ──────────────────────────────────────────────────────
export async function marcarPagamentoConfirmado(pagarmeOrderId: string): Promise<void> {
  const { rows } = await db.query(
    `${SELECT_SESSAO_BASE} WHERE s.pagarme_order_id = $1 LIMIT 1`,
    [pagarmeOrderId],
  )
  const sessao = rows[0] ? rowToSessao(rows[0]) : null
  if (!sessao) {
    log.warn('pagarme.webhook', `order ${pagarmeOrderId} não encontrado em sessões`)
    return
  }
  if (sessao.pagamentoStatus === 'pago') return

  await db.query(
    `UPDATE sessoes SET pagamento_status='pago', status='confirmada' WHERE id = $1`,
    [sessao.id],
  )
  publish({ type: 'sessao.confirmada', sessaoId: sessao.id, pacienteId: sessao.pacienteId })
  publish({ type: 'pagamento.recebido', sessaoId: sessao.id, valor: sessao.valor })
  await enviarWA(sessao.pacienteTelefone, WA_TEMPLATES.fluxo2_confirmado(formatDateTimeBR(sessao.dataHora)))
  log.ok('pagarme.webhook', `sessão ${sessao.id} confirmada`)
}

export async function marcarPagamentoCancelado(pagarmeOrderId: string): Promise<void> {
  await db.query(
    `UPDATE sessoes SET pagamento_status='falhou' WHERE pagarme_order_id = $1`,
    [pagarmeOrderId],
  )
  log.info('pagarme.webhook', `order ${pagarmeOrderId} cancelado / expirado`)
}

// ── Cancelamento com regra de reembolso (Fluxo 5) ─────────────────────────
export async function cancelarSessao(sessaoId: string): Promise<{ reembolsada: boolean }> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')

  const horasAteSessao = (+new Date(s.dataHora) - Date.now()) / (1000 * 60 * 60)
  let reembolsada = false

  if (s.pagamentoStatus === 'pago' && horasAteSessao > 24 && s.pagarmeOrderId) {
    reembolsada = await reembolsar(s.pagarmeOrderId)
  }

  await db.query(
    `UPDATE sessoes SET status='cancelada', pagamento_status = CASE WHEN $2 THEN 'reembolsado' ELSE pagamento_status END WHERE id=$1`,
    [s.id, reembolsada],
  )

  await enviarWA(
    s.pacienteTelefone,
    reembolsada ? WA_TEMPLATES.fluxo5_canceladaComReembolso() : WA_TEMPLATES.fluxo5_canceladaSemReembolso(),
  )

  return { reembolsada }
}

// ── Iniciar / Encerrar / Assinar ──────────────────────────────────────────
export async function iniciarSessao(sessaoId: string): Promise<void> {
  await db.query(`UPDATE sessoes SET status='em_curso' WHERE id=$1`, [sessaoId])
  publish({ type: 'sessao.iniciada', sessaoId })
}

export async function encerrarSessao(sessaoId: string, opts: { transcricao?: string; indicadores?: any } = {}): Promise<void> {
  const patches: string[] = [`status='concluida'`]
  const params: any[] = [sessaoId]
  if (opts.transcricao) {
    patches.push(`transcricao_texto = $${params.length + 1}`)
    params.push(encrypt(opts.transcricao))
  }
  if (opts.indicadores) {
    patches.push(`indicadores = $${params.length + 1}`)
    params.push(JSON.stringify(opts.indicadores))
  }
  await db.query(`UPDATE sessoes SET ${patches.join(', ')} WHERE id=$1`, params)
  publish({ type: 'sessao.encerrada', sessaoId })
}

export async function salvarResumoIA(sessaoId: string, resumo: string): Promise<void> {
  await db.query(`UPDATE sessoes SET resumo_ia = $2 WHERE id = $1`, [sessaoId, encrypt(resumo)])
}

export async function assinarSessao(sessaoId: string): Promise<void> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')
  await db.query(
    `UPDATE sessoes SET assinada = TRUE, assinatura_timestamp = NOW() WHERE id = $1`,
    [sessaoId],
  )
  // Fluxo 6 — pós-sessão.
  await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo6_posSessao(s.numero))
}

export async function reenviarCobranca(sessaoId: string): Promise<Sessao> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')
  if (!s.pagamentoMetodo) {
    // ainda não escolheu — re-pergunta
    await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo2_perguntarMetodo(formatDateTimeBR(s.dataHora), s.valor))
    return s
  }
  if (s.pagamentoMetodo === 'pix')     return gerarCobrancaPix(sessaoId)
  return gerarCobrancaCartao(sessaoId, s.pagamentoMetodo)
}
