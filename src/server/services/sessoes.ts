import 'server-only'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { criarOrderPix, criarCheckoutCartao, reembolsar } from '@/server/lib/pagarme'
import { publish } from '@/server/lib/sse'
import { encrypt, decrypt, tryDecrypt } from '@/server/lib/crypto'
import { log } from '@/server/lib/log'
import { enviarEmailPacientePorSessao, enviarEmailPacientePorId } from '@/server/lib/emailPaciente'
import {
  tplSessaoConfirmada, tplSessaoCancelada, tplSerieAgendada,
} from '@/server/lib/emailTemplates'
import { formatDateTimeBR } from '@/lib/formatters'
import { obterAssinatura } from './assinatura'
import { incrementarSessaoIa } from './uso'
import { BETA_LIBERADO } from '@/server/lib/planos'

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
  serieId: string | null
  /** Posição na série (1-based) e total. Só preenchido em listarSessoesEntre. */
  seriePosicao: { posicao: number; total: number } | null
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
    serieId: r.serie_id ?? null,
    seriePosicao: r.serie_posicao && r.serie_total
      ? { posicao: parseInt(r.serie_posicao, 10), total: parseInt(r.serie_total, 10) }
      : null,
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
  // CTE serie_stats: pra cada serie_id que aparece no range, computa posição
  // (ordenada por data_hora) e total da série. LEFT JOIN devolve null pras
  // avulsas (sem serie_id), que é o comportamento esperado.
  const { rows } = await db.query(
    `WITH range_series AS (
       SELECT DISTINCT serie_id FROM sessoes
        WHERE psicologo_id = $1
          AND data_hora >= $2 AND data_hora <= $3
          AND serie_id IS NOT NULL
     ),
     serie_stats AS (
       SELECT s.id, s.serie_id,
              row_number() OVER (PARTITION BY s.serie_id ORDER BY s.data_hora) AS serie_posicao,
              count(*) OVER (PARTITION BY s.serie_id) AS serie_total
         FROM sessoes s
        WHERE s.serie_id IN (SELECT serie_id FROM range_series)
     )
     SELECT s.*,
            p.nome AS paciente_nome,
            p.telefone AS paciente_telefone,
            p.email AS paciente_email,
            ss.serie_posicao,
            ss.serie_total
       FROM sessoes s
       JOIN pacientes p ON p.id = s.paciente_id
       LEFT JOIN serie_stats ss ON ss.id = s.id
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
    `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade, status, valor, wa_pergunta_metodo_em)
     VALUES ($1,$2,$3,$4,$5,$6,'aguardando_metodo',$7, NOW())
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

// ── Séries recorrentes ────────────────────────────────────────────────────
export type FrequenciaSerie = 'semanal' | 'quinzenal'

export type CriarSerieInput = {
  psicologoId: string
  pacienteId: string
  /** Data/hora da primeira sessão (ISO). */
  primeiraSessaoIso: string
  frequencia: FrequenciaSerie
  quantidade: number
  duracaoMin?: number
  modalidade?: string
  valor: number
}

export type CriarSerieResult = {
  serieId: string
  sessoesIds: string[]
  datas: string[]    // ISO de todas as sessões geradas
}

/**
 * Gera as datas ISO de uma série a partir da primeira.
 * Pure function — testável. Semanal = +7d; Quinzenal = +14d.
 */
export function gerarDatasSerie(primeiraIso: string, freq: FrequenciaSerie, qtd: number): string[] {
  const passoDias = freq === 'semanal' ? 7 : 14
  const inicio = new Date(primeiraIso)
  const out: string[] = []
  for (let i = 0; i < qtd; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i * passoDias)
    out.push(d.toISOString())
  }
  return out
}

/**
 * Detecta sessões já existentes do mesmo psicólogo em ±5min de cada data.
 * Devolve um Set de ISOs que têm conflito. Útil pra UI marcar antes de enviar.
 */
export async function detectarConflitosSerie(
  psicologoId: string, datas: string[],
): Promise<Set<string>> {
  if (datas.length === 0) return new Set()
  const placeholders = datas.map((_, i) => `$${i + 2}::timestamptz`).join(',')
  const { rows } = await db.query<{ data_hora: string }>(
    `SELECT data_hora FROM sessoes
      WHERE psicologo_id = $1
        AND status NOT IN ('cancelada', 'no_show')
        AND data_hora IN (${placeholders})`,
    [psicologoId, ...datas],
  )
  return new Set(rows.map(r => new Date(r.data_hora).toISOString()))
}

/**
 * Cria N sessões da série. Pula Fluxo 2 individual — manda 1 mensagem
 * informativa única. Cron /api/cron/perguntar-metodo dispara Fluxo 2
 * 48h antes de cada sessão.
 */
export async function criarSerie(input: CriarSerieInput): Promise<CriarSerieResult> {
  if (input.quantidade < 2) throw new Error('serie_minimo_2_sessoes')
  if (input.quantidade > 52) throw new Error('serie_maximo_52_sessoes')

  const datas = gerarDatasSerie(input.primeiraSessaoIso, input.frequencia, input.quantidade)

  // próximo número de sessão pra esse paciente
  const { rows: count } = await db.query<{ n: number }>(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM sessoes WHERE paciente_id = $1`,
    [input.pacienteId],
  )
  let proxNumero = count[0].n

  // Transação: insere todas ou nenhuma
  const cliente = await db.connect()
  let serieId = ''
  const sessoesIds: string[] = []
  try {
    await cliente.query('BEGIN')
    const r = await cliente.query<{ id: string }>(`SELECT gen_random_uuid() AS id`)
    serieId = r.rows[0].id

    for (const dataIso of datas) {
      const { rows } = await cliente.query<{ id: string }>(
        `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade, status, valor, serie_id)
         VALUES ($1,$2,$3,$4,$5,$6,'aguardando_metodo',$7,$8)
         RETURNING id`,
        [
          input.psicologoId, input.pacienteId, proxNumero++,
          dataIso, input.duracaoMin ?? 50, input.modalidade ?? 'online',
          input.valor, serieId,
        ],
      )
      sessoesIds.push(rows[0].id)
    }
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    log.err('criarSerie', 'transação falhou', err)
    throw err
  } finally {
    cliente.release()
  }

  // Notificação ao paciente nos dois canais — depois do COMMIT.
  const { rows: pac } = await db.query<{ nome: string; telefone: string }>(
    `SELECT nome, telefone FROM pacientes WHERE id = $1`, [input.pacienteId],
  )
  const { rows: psiS } = await db.query<{ nome: string; email: string }>(
    `SELECT nome, email FROM psicologos WHERE id = $1 LIMIT 1`, [input.psicologoId])
  if (pac[0]) {
    const datasFormatadas = datas.map(d => formatDateTimeBR(d))
    await Promise.all([
      enviarWA(
        pac[0].telefone,
        WA_TEMPLATES.fluxo2_serieInformativa({
          nome: pac[0].nome,
          datas: datasFormatadas,
          valor: input.valor,
        }),
      ).catch(err => log.err('criarSerie', 'falha WA', err)),
      psiS[0] ? enviarEmailPacientePorId(
        input.pacienteId,
        tplSerieAgendada({
          nomePaciente: pac[0].nome,
          psicologoNome: psiS[0].nome,
          psicologoEmail: psiS[0].email,
          datas: datasFormatadas,
          valor: input.valor,
        }),
        'criarSerie',
      ) : Promise.resolve(),
    ])
  }

  log.ok('criarSerie', `${sessoesIds.length} sessões serie=${serieId} paciente=${input.pacienteId}`)
  return { serieId, sessoesIds, datas }
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
    `UPDATE sessoes SET pagamento_status='pago', status='confirmada', pago_em = NOW() WHERE id = $1`,
    [sessao.id],
  )
  publish({ type: 'sessao.confirmada', sessaoId: sessao.id, pacienteId: sessao.pacienteId })
  publish({ type: 'pagamento.recebido', sessaoId: sessao.id, valor: sessao.valor })

  // Notificação ao paciente nos dois canais — falhas isoladas não bloqueiam.
  const { rows: psis } = await db.query<{ nome: string; email: string }>(
    `SELECT nome, email FROM psicologos WHERE id = $1 LIMIT 1`, [sessao.psicologoId])
  await Promise.all([
    enviarWA(sessao.pacienteTelefone, WA_TEMPLATES.fluxo2_confirmado(formatDateTimeBR(sessao.dataHora)))
      .catch(err => log.err('pagamento.confirmado', 'falha WA', err)),
    psis[0] ? enviarEmailPacientePorSessao(
      sessao.id,
      tplSessaoConfirmada({
        nomePaciente: sessao.pacienteNome,
        psicologoNome: psis[0].nome,
        psicologoEmail: psis[0].email,
        dataHora: formatDateTimeBR(sessao.dataHora),
        modalidade: sessao.modalidade,
      }),
      'pagamento.confirmado',
    ) : Promise.resolve(),
  ])

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

  const { rows: psisC } = await db.query<{ nome: string; email: string }>(
    `SELECT nome, email FROM psicologos WHERE id = $1 LIMIT 1`, [s.psicologoId])
  await Promise.all([
    enviarWA(
      s.pacienteTelefone,
      reembolsada ? WA_TEMPLATES.fluxo5_canceladaComReembolso() : WA_TEMPLATES.fluxo5_canceladaSemReembolso(),
    ).catch(err => log.err('sessao.cancelar', 'falha WA', err)),
    psisC[0] ? enviarEmailPacientePorSessao(
      s.id,
      tplSessaoCancelada({
        nomePaciente: s.pacienteNome,
        psicologoNome: psisC[0].nome,
        psicologoEmail: psisC[0].email,
        dataHora: formatDateTimeBR(s.dataHora),
        comReembolso: reembolsada,
      }),
      'sessao.cancelar',
    ) : Promise.resolve(),
  ])

  return { reembolsada }
}

// ── Iniciar / Encerrar / Assinar ──────────────────────────────────────────
export async function iniciarSessao(sessaoId: string): Promise<void> {
  await db.query(`UPDATE sessoes SET status='em_curso' WHERE id=$1`, [sessaoId])
  publish({ type: 'sessao.iniciada', sessaoId })
}

export type GateRegistroResult =
  | { ok: true }
  | { ok: false; motivo: 'limite'; cap: number; usadas: number; plano: string }

/**
 * Gate do Modo Presença: chamado ao iniciar o REGISTRO (transcrição/IA), que é
 * onde o custo acontece. Conta 1 da cota mensal de sessões-IA, de forma
 * idempotente (flag `ia_contabilizada` — pausar/retomar não recota). Bloqueia
 * se a cota do plano já estiver esgotada.
 */
export async function gateIniciarRegistroIa(sessaoId: string): Promise<GateRegistroResult> {
  // Beta: acesso liberado — nunca bloqueia e não contabiliza cota (sem mensalidade).
  if (BETA_LIBERADO) return { ok: true }

  const { rows } = await db.query<{ psicologo_id: string; ia_contabilizada: boolean }>(
    `SELECT psicologo_id, ia_contabilizada FROM sessoes WHERE id = $1 LIMIT 1`,
    [sessaoId],
  )
  const sessao = rows[0]
  if (!sessao) return { ok: true }                 // sessão inexistente: não trava o front
  if (sessao.ia_contabilizada) return { ok: true } // já contou: retomar registro é livre

  const info = await obterAssinatura(sessao.psicologo_id)
  if (info.usadas >= info.cap) {
    return { ok: false, motivo: 'limite', cap: info.cap, usadas: info.usadas, plano: info.plano }
  }

  // Marca a sessão como contabilizada de forma atômica; só incrementa se ESTA
  // chamada fez a transição (evita corrida de duplo clique).
  const { rowCount } = await db.query(
    `UPDATE sessoes SET ia_contabilizada = TRUE
      WHERE id = $1 AND ia_contabilizada = FALSE`,
    [sessaoId],
  )
  if (rowCount) await incrementarSessaoIa(sessao.psicologo_id)
  return { ok: true }
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
