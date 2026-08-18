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
import { formatDateTimeBR, formatDateBR, formatTimeBR, TZ } from '@/lib/formatters'
import { sessaoVazia, sqlTemRegistro, sqlTemCobrancaAberta } from '@/lib/sessaoExclusao'
import { obterAssinatura } from './assinatura'
import { incrementarSessaoIa, decrementarSessaoIa } from './uso'
import { lerStatusOnboarding } from './onboardingPagamento'
import { BETA_LIBERADO } from '@/server/lib/planos'
import { validarCpf } from '@/lib/documento'

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
  /**
   * CPF do paciente (só dígitos), de `pacientes.dados_cadastro.cpf`.
   * **Obrigatório para PIX** — a Pagar.me recusa a charge sem `customer.document`
   * e devolve a order sem QR code. Null quando não foi preenchido no cadastro.
   */
  pacienteCpf: string | null
  /** 'ativo' | 'inativo' (arquivado). Usado pra não contar pendência de arquivado. */
  pacienteStatus: string | null
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
  /** Quando o laudo assinado foi retificado pela última vez (ou null). */
  resumoEditadoEm: string | null
  /** Versões anteriores do laudo assinado, preservadas em cada retificação. */
  resumoHistorico: { texto: string; em: string }[]
  /** Registro assinado da sessão (resumo) — o que dirige a continuidade. */
  resumoIa: string | null
  /** Resumo curto automático (fast) — rascunho do registro, pré-preenche a assinatura. */
  resumoCurto: string | null
  /** Laudo formal CFP (modelo forte), gerado sob demanda — separado da continuidade. */
  laudo: string | null
  transcricao: string | null
  notaClinica: string | null
  /** Ritmo, humor, risco e nota rápida da sessão (JSONB). Salvo no encerrar. */
  indicadores: any | null
  serieId: string | null
  /** Posição na série (1-based) e total. Só preenchido em listarSessoesEntre. */
  seriePosicao: { posicao: number; total: number } | null
  /** Sessão de histórico importado (não dispara WhatsApp pós-sessão ao assinar). */
  importada: boolean
}

function rowToSessao(r: any): Sessao {
  return {
    id: r.id, psicologoId: r.psicologo_id, pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome, pacienteTelefone: r.paciente_telefone, pacienteEmail: r.paciente_email,
    pacienteCpf: r.paciente_cpf ? String(r.paciente_cpf).replace(/\D/g, '') || null : null,
    pacienteStatus: r.paciente_status ?? null,
    numero: r.numero, dataHora: r.data_hora, duracaoMin: r.duracao_min, modalidade: r.modalidade,
    status: r.status, pagamentoStatus: r.pagamento_status, pagamentoMetodo: r.pagamento_metodo,
    pagamentoParcelas: r.pagamento_parcelas,
    pagarmeOrderId: r.pagarme_order_id, pagarmeQrcode: r.pagarme_qrcode,
    pagarmeQrcodeUrl: r.pagarme_qrcode_url, pagarmeCheckoutUrl: r.pagarme_checkout_url,
    valor: parseFloat(r.valor),
    assinada: r.assinada, assinaturaTimestamp: r.assinatura_timestamp,
    resumoEditadoEm: r.resumo_editado_em ?? null,
    resumoHistorico: Array.isArray(r.resumo_historico)
      ? r.resumo_historico.map((h: any) => ({ texto: tryDecrypt(h?.texto) ?? '', em: h?.em ?? '' }))
      : [],
    resumoIa: tryDecrypt(r.resumo_ia),
    resumoCurto: tryDecrypt(r.resumo_curto),
    laudo: tryDecrypt(r.laudo),
    transcricao: tryDecrypt(r.transcricao_texto),
    notaClinica: tryDecrypt(r.nota_clinica),
    indicadores: r.indicadores ?? null,
    serieId: r.serie_id ?? null,
    seriePosicao: r.serie_posicao && r.serie_total
      ? { posicao: parseInt(r.serie_posicao, 10), total: parseInt(r.serie_total, 10) }
      : null,
    importada: r.importada === true,
  }
}

const SELECT_SESSAO_BASE = `
  SELECT s.*,
         p.nome AS paciente_nome,
         p.telefone AS paciente_telefone,
         p.email AS paciente_email,
         p.dados_cadastro->>'cpf' AS paciente_cpf,
         p.status AS paciente_status
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
            p.status AS paciente_status,
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
        AND p.status = 'ativo'
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

  // Sessão gratuita (valor 0): pula a cobrança — já nasce confirmada, sem WhatsApp de método.
  const gratuita = (input.valor ?? 0) <= 0

  // Cobrança pela plataforma (Pix/cartão via Pagar.me) só pra quem já vinculou a
  // conta de recebimento. Sem conta, a sessão paga é agendada e confirmada — o
  // psicólogo combina o pagamento por fora e concilia no Financeiro (fica 'pendente').
  const onboarding = gratuita ? null : await lerStatusOnboarding(input.psicologoId)
  const cobrarPlataforma = !gratuita && !!onboarding?.completo

  const { rows } = await db.query(
    `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade, status, valor, pagamento_status, wa_pergunta_metodo_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      input.psicologoId, input.pacienteId, numero, input.dataHora,
      input.duracaoMin ?? 50, input.modalidade ?? 'online',
      cobrarPlataforma ? 'aguardando_metodo' : 'confirmada',
      input.valor,
      gratuita ? 'isento' : 'pendente',
      cobrarPlataforma ? new Date().toISOString() : null,
    ],
  )
  const sessao = (await buscarSessao(rows[0].id))!

  // Fluxo 2 — WhatsApp pra TODOS. Três casos:
  //  · cobra pela plataforma  → pergunta o método (Pix/cartão);
  //  · grátis (valor 0)       → confirma sem pagamento;
  //  · pago, sem recebimento  → confirma e informa pagamento direto com o psicólogo.
  const online = sessao.modalidade === 'online'
  await enviarWA(
    sessao.pacienteTelefone,
    cobrarPlataforma
      ? WA_TEMPLATES.fluxo2_perguntarMetodo(formatDateTimeBR(sessao.dataHora), sessao.valor)
      : gratuita
        ? WA_TEMPLATES.fluxo2_agendadaSemCobranca(formatDateTimeBR(sessao.dataHora), online)
        : WA_TEMPLATES.fluxo2_agendadaPagamentoDireto(formatDateTimeBR(sessao.dataHora), sessao.valor, online),
  ).catch(err => log.err('criarSessao', 'falha WA agendamento', err))

  return sessao
}

/** Reagenda a sessão (data/hora, duração, modalidade). Verifica posse. */
/**
 * Remarca uma sessão. `escopo`:
 *  - 'uma' (default): só esta sessão.
 *  - 'seguintes': ESTA e todas as SEGUINTES da mesma série (futuras, não
 *    concluídas/canceladas/em curso). Aplica o MESMO delta de data/hora a todas
 *    → preserva a cadência (semanal continua semanal) e joga a série pro novo
 *    dia/horário. Duração/modalidade do patch também se aplicam ao escopo.
 * Avisa o paciente por WhatsApp quando a data muda: um resumo único no lote,
 * a mensagem normal quando é só uma.
 */
export async function reagendarSessao(
  psicologoId: string, sessaoId: string,
  patch: { dataHora?: string; duracaoMin?: number; modalidade?: string },
  escopo: 'uma' | 'seguintes' = 'uma',
): Promise<{ ok: boolean; afetadas: number }> {
  const { rows: alvoRows } = await db.query<{ data_hora: string; serie_id: string | null }>(
    `SELECT data_hora, serie_id FROM sessoes WHERE id = $1 AND psicologo_id = $2`, [sessaoId, psicologoId],
  )
  const alvo = alvoRows[0]
  if (!alvo) return { ok: false, afetadas: 0 }

  const dataOriginal = alvo.data_hora
  const mudouData = patch.dataHora !== undefined &&
    new Date(dataOriginal).getTime() !== new Date(patch.dataHora).getTime()
  const deltaMs = patch.dataHora !== undefined
    ? new Date(patch.dataHora).getTime() - new Date(dataOriginal).getTime()
    : 0
  const emSerie = escopo === 'seguintes' && !!alvo.serie_id

  let afetadas = 0
  if (emSerie) {
    // "Esta e as seguintes" — delta-shift na série (a partir desta), só futuras.
    const sets: string[] = []
    const vals: any[] = [alvo.serie_id, psicologoId, dataOriginal]
    if (patch.dataHora !== undefined) { sets.push(`data_hora = data_hora + ($${vals.length + 1} * interval '1 millisecond')`); vals.push(deltaMs) }
    if (patch.duracaoMin !== undefined) { sets.push(`duracao_min = $${vals.length + 1}`); vals.push(patch.duracaoMin) }
    if (patch.modalidade !== undefined) { sets.push(`modalidade = $${vals.length + 1}`); vals.push(patch.modalidade) }
    if (sets.length === 0) return { ok: false, afetadas: 0 }
    const { rowCount } = await db.query(
      `UPDATE sessoes SET ${sets.join(', ')}
        WHERE serie_id = $1 AND psicologo_id = $2 AND data_hora >= $3
          AND status NOT IN ('concluida', 'cancelada', 'em_curso')`, vals,
    )
    afetadas = rowCount ?? 0
  } else {
    const fields: string[] = []
    const vals: any[] = [sessaoId, psicologoId]
    const set = (col: string, v: any) => { fields.push(`${col} = $${vals.length + 1}`); vals.push(v) }
    if (patch.dataHora !== undefined)   set('data_hora', patch.dataHora)
    if (patch.duracaoMin !== undefined) set('duracao_min', patch.duracaoMin)
    if (patch.modalidade !== undefined) set('modalidade', patch.modalidade)
    if (fields.length === 0) return { ok: false, afetadas: 0 }
    const { rowCount } = await db.query(
      `UPDATE sessoes SET ${fields.join(', ')} WHERE id = $1 AND psicologo_id = $2`, vals,
    )
    afetadas = rowCount ?? 0
  }

  const ok = afetadas > 0

  // Avisa o paciente por WhatsApp (best-effort, só se a data mudou).
  if (ok && mudouData) {
    const sessao = await buscarSessao(sessaoId) // já com a nova data_hora (esta é a 1ª do lote)
    if (sessao?.pacienteTelefone) {
      if (emSerie && afetadas > 1) {
        const nova = sessao.dataHora
        const diaSemana = new Date(nova).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ })
        const slot = `${diaSemana} às ${formatTimeBR(nova)}, a partir de ${formatDateBR(nova)}`
        await enviarWA(sessao.pacienteTelefone, WA_TEMPLATES.fluxo2_remarcadaSerie(afetadas, slot))
          .catch(err => log.err('reagendarSessao', 'falha WA remarcada série', err))
      } else {
        await enviarWA(sessao.pacienteTelefone, WA_TEMPLATES.fluxo2_remarcada(formatDateTimeBR(sessao.dataHora)))
          .catch(err => log.err('reagendarSessao', 'falha WA remarcada', err))
      }
    }
  }
  return { ok, afetadas }
}

export type ExcluirSessaoResult =
  | { ok: true; renumeradas: number }
  | { ok: false; motivo: 'nao_encontrada' | 'em_curso' | 'registro' | 'paga' | 'cobranca' }

/**
 * Exclui (hard delete) uma sessão VAZIA — pra limpar agendamento criado por
 * engano e também a sessão que foi encerrada sem nada ter sido registrado
 * (clicou "Encerrar" numa sessão que não aconteceu, microfone falhou). Essa
 * segunda ficava presa: `concluida` sem conteúdo não podia ser excluída, nem
 * cancelada, nem marcada como sem comparecimento — e ainda puxava o badge
 * "Registrar" do paciente e entrava nos indicadores do financeiro.
 *
 * Diferente de `cancelarSessao` (soft-delete com reembolso + aviso), some de vez.
 *
 * Guardas:
 *  - 'em_curso': destrave/encerre antes — enquanto roda, a transcrição ainda
 *    pode chegar e o DELETE correria com o encerrar.
 *  - 'registro': assinada ou com qualquer texto clínico. Prontuário não se apaga.
 *  - 'paga': dinheiro retido do paciente. Bloqueia; o caminho certo é cancelar
 *    (reembolsa + avisa), não sumir com a sessão silenciosamente.
 *
 * Dependentes (salas_video, sessao_grafo, palavras_chave.ultima_sessao_id,
 * objetivo_smart.sessao_id) têm ON DELETE cascade/set null, então o DELETE é
 * limpo. `api_custos.sessao_id` não tem FK de propósito — o histórico de custo
 * sobrevive à exclusão.
 *
 * Fecha o buraco na numeração quando é seguro — ver `renumerarApos`.
 */
export async function excluirSessao(psicologoId: string, sessaoId: string): Promise<ExcluirSessaoResult> {
  // Esta leitura serve pra DIZER o que impede a exclusão (mensagem específica).
  // Quem de fato autoriza é o WHERE do DELETE lá embaixo — entre ler e apagar,
  // a sessão pode ser assinada ou paga por outra requisição.
  const s = await buscarSessao(sessaoId)
  if (!s || s.psicologoId !== psicologoId) return { ok: false, motivo: 'nao_encontrada' }
  if (s.status === 'em_curso') return { ok: false, motivo: 'em_curso' }
  if (!sessaoVazia(s)) return { ok: false, motivo: 'registro' }
  if (s.pagamentoStatus === 'pago') return { ok: false, motivo: 'paga' }
  // Cobrança ativa (PIX/checkout gerado, ainda pendente): deletar a linha
  // orfaniza a cobrança — se o paciente pagar depois, o webhook não acha a
  // sessão e o dinheiro entra sem reembolso. Bloqueia; o certo é cancelar.
  if (s.pagarmeOrderId && s.pagamentoStatus === 'pendente') return { ok: false, motivo: 'cobranca' }

  // DELETE + renumeração na MESMA transação: um buraco temporário na sequência
  // (ou um shift sem o delete) nunca fica visível pra outra requisição.
  const cliente = await db.connect()
  let contabilizada = false
  let renumeradas = 0
  try {
    await cliente.query('BEGIN')

    // As guardas repetidas no WHERE são o que torna a exclusão atômica: a linha
    // só sai se AINDA estiver vazia e sem dinheiro preso no instante do DELETE.
    // RETURNING amarra leitura e remoção na mesma ida, então duplo clique não
    // estorna cota duas vezes — só a primeira chamada acha a linha.
    const { rows } = await cliente.query<{ ia_contabilizada: boolean | null; paciente_id: string; numero: number }>(
      `DELETE FROM sessoes
        WHERE id = $1 AND psicologo_id = $2
          AND COALESCE(status, '') <> 'em_curso'
          AND NOT ${sqlTemRegistro()}
          AND COALESCE(pagamento_status, '') <> 'pago'
          AND NOT ${sqlTemCobrancaAberta()}
       RETURNING ia_contabilizada, paciente_id, numero`,
      [sessaoId, psicologoId],
    )
    // Chegou aqui com as guardas passando na leitura e mesmo assim não apagou:
    // outra requisição mexeu na sessão no meio. 'registro' é o palpite honesto.
    if (!rows[0]) { await cliente.query('ROLLBACK'); return { ok: false, motivo: 'registro' } }
    contabilizada = rows[0].ia_contabilizada === true
    renumeradas = await renumerarApos(cliente, rows[0].paciente_id, rows[0].numero)

    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    log.err('excluirSessao', `transação falhou (sessão ${sessaoId})`, err)
    throw err
  } finally {
    cliente.release()
  }

  // Se a sessão chegou a abrir o registro com IA (e não gerou nada), a cota do
  // mês volta. Fora da transação: mexe em outra tabela e não pode desfazer o
  // DELETE se falhar.
  if (contabilizada) await decrementarSessaoIa(psicologoId)
  return { ok: true, renumeradas }
}

/**
 * Fecha o buraco deixado por uma exclusão: as sessões seguintes do paciente
 * descem 1 no `numero`. Devolve quantas desceram (0 = não mexeu).
 *
 * Só renumera quando NENHUMA das seguintes tem documento gerado ou assinatura.
 * Motivo: o número da sessão é injetado no prompt do laudo e do resumo ("Gere o
 * registro da sessão #N", ver `anthropic.ts`), então ele fica escrito DENTRO do
 * texto assinado. Renumerar a linha não reescreve o documento — a sessão passaria
 * a se exibir como #4 com um laudo assinado dizendo #5. Entre um buraco na
 * sequência e um prontuário que se contradiz, o buraco é o mal menor.
 *
 * Na prática o caso comum renumera: excluir a última não deixa buraco nenhum
 * (o próximo `numero` é MAX+1, que volta a ser o mesmo), e excluir uma futura no
 * meio de uma série mexe só em sessões que ainda não têm registro.
 *
 * Não há UNIQUE em (paciente_id, numero), então o shift num UPDATE só não
 * esbarra em conflito transitório.
 */
async function renumerarApos(
  cliente: { query: typeof db.query }, pacienteId: string, numero: number,
): Promise<number> {
  // FOR UPDATE trava as linhas que vão descer até o fim da transação.
  const { rows: seguintes } = await cliente.query<{ tem_documento: boolean }>(
    `SELECT (COALESCE(assinada, FALSE) OR resumo_ia IS NOT NULL
             OR resumo_curto IS NOT NULL OR laudo IS NOT NULL)
              AS tem_documento
       FROM sessoes WHERE paciente_id = $1 AND numero > $2
       FOR UPDATE`,
    [pacienteId, numero],
  )
  if (seguintes.length === 0 || seguintes.some(r => r.tem_documento)) return 0

  const { rowCount } = await cliente.query(
    `UPDATE sessoes SET numero = numero - 1 WHERE paciente_id = $1 AND numero > $2`,
    [pacienteId, numero],
  )
  return rowCount ?? 0
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
  const gratuita = (input.valor ?? 0) <= 0

  // Cobrança pela plataforma só pra quem vinculou conta de recebimento (ver criarSessao).
  const onboarding = gratuita ? null : await lerStatusOnboarding(input.psicologoId)
  const cobrarPlataforma = !gratuita && !!onboarding?.completo

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
        `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade, status, valor, pagamento_status, serie_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          input.psicologoId, input.pacienteId, proxNumero++,
          dataIso, input.duracaoMin ?? 50, input.modalidade ?? 'online',
          cobrarPlataforma ? 'aguardando_metodo' : 'confirmada',
          input.valor, gratuita ? 'isento' : 'pendente', serieId,
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
          gratuita,
          pagamentoDireto: !gratuita && !cobrarPlataforma,
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
  const onb = await lerStatusOnboarding(s.psicologoId)
  if (!onb.completo) throw new Error('recebimento_nao_configurado')
  // A Pagar.me exige CPF do pagador no PIX. Sem ele a order até é criada, mas a
  // charge é reprovada e volta SEM qr_code — o paciente receberia um link vazio.
  // Falhar aqui, com erro nomeado, é melhor que cobrar e não gerar o QR.
  if (!s.pacienteCpf) throw new Error('cpf_paciente_ausente')
  // Cadastro antigo pode ter CPF digitado errado (a validação no salvar é nova).
  // Um CPF inválido chega à Pagar.me, reprova a charge e volta sem QR — o mesmo
  // beco sem saída do CPF ausente, só que com mensagem genérica.
  if (!validarCpf(s.pacienteCpf)) throw new Error('cpf_paciente_invalido')

  const order = await criarOrderPix({
    sessaoId: s.id,
    valorCentavos: Math.round(s.valor * 100),
    pacienteNome: s.pacienteNome,
    pacienteEmail: s.pacienteEmail,
    pacienteTelefone: s.pacienteTelefone,
    pacienteDocumento: s.pacienteCpf,
    // Split: o líquido cai direto na conta do psicólogo; a comissão da
    // plataforma e a taxa da Pagar.me saem na própria liquidação.
    recipientPsicologo: onb.recipientId,
  })

  await db.query(
    `UPDATE sessoes
        SET status='aguardando_pagamento', pagamento_metodo='pix', pagamento_parcelas=1,
            pagarme_order_id=$2, pagarme_qrcode=$3, pagarme_qrcode_url=$4,
            comissao_centavos=$5, wa_metodo_escolhido=TRUE
      WHERE id=$1`,
    [s.id, order.orderId, order.qrCode ?? null, order.qrCodeUrl ?? null, order.comissaoCentavos || null],
  )

  await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo2_pix(order.qrCodeUrl ?? order.qrCode ?? '', s.valor))
  return (await buscarSessao(s.id))!
}

export async function gerarCobrancaCartao(sessaoId: string, metodo: 'credito' | 'debito'): Promise<Sessao> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')
  const onb = await lerStatusOnboarding(s.psicologoId)
  if (!onb.completo) throw new Error('recebimento_nao_configurado')

  const order = await criarCheckoutCartao({
    sessaoId: s.id,
    valorCentavos: Math.round(s.valor * 100),
    metodo,
    pacienteNome: s.pacienteNome,
    pacienteEmail: s.pacienteEmail,
    // Split: o líquido cai direto na conta do psicólogo; a comissão da
    // plataforma e a taxa da Pagar.me saem na própria liquidação.
    recipientPsicologo: onb.recipientId,
  })

  await db.query(
    `UPDATE sessoes
        SET status='aguardando_pagamento', pagamento_metodo=$2,
            pagarme_order_id=$3, pagarme_checkout_url=$4,
            comissao_centavos=$5, wa_metodo_escolhido=TRUE
      WHERE id=$1`,
    [s.id, metodo, order.orderId, order.checkoutUrl ?? null, order.comissaoCentavos || null],
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
    enviarWA(sessao.pacienteTelefone, WA_TEMPLATES.fluxo2_confirmado(formatDateTimeBR(sessao.dataHora), sessao.modalidade === 'online'))
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
    `UPDATE sessoes SET status='cancelada', pagamento_status = CASE WHEN $2::boolean THEN 'reembolsado' ELSE pagamento_status END WHERE id=$1`,
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

export type CancelarPeloPsicologoResult =
  | { ok: true; reembolsada: boolean }
  | { ok: false; motivo: 'nao_encontrada' | 'realizada' | 'em_curso' | 'ja_cancelada' }

/**
 * Cancelamento a partir do painel. `cancelarSessao` (Fluxo 5) nasceu pro webhook
 * do WhatsApp, onde quem cancela é o PACIENTE e a posse já vem resolvida; aqui
 * quem cancela é a psicóloga, então precisa de checagem de dono + guardas.
 * Reembolso e avisos continuam sendo responsabilidade do Fluxo 5.
 */
export async function cancelarSessaoDoPsicologo(
  psicologoId: string, sessaoId: string,
): Promise<CancelarPeloPsicologoResult> {
  const s = await buscarSessao(sessaoId)
  if (!s || s.psicologoId !== psicologoId) return { ok: false, motivo: 'nao_encontrada' }
  if (s.status === 'cancelada') return { ok: false, motivo: 'ja_cancelada' }
  // Sessão que virou prontuário não se cancela — ela aconteceu.
  if (s.assinada || s.status === 'concluida') return { ok: false, motivo: 'realizada' }
  // Em curso: interromper primeiro (libera a cota e devolve pra fila), aí cancela.
  if (s.status === 'em_curso') return { ok: false, motivo: 'em_curso' }

  const { reembolsada } = await cancelarSessao(sessaoId)
  return { ok: true, reembolsada }
}

export type NoShowResult = { ok: true; status: SessaoStatus } | { ok: false; motivo: 'nao_encontrada' | 'realizada' | 'em_curso' }

/**
 * Marca / desmarca "sem comparecimento". O status existia no schema desde o
 * início e alimenta KPIs (taxa de absenteísmo, badge "Atenção" do paciente),
 * mas nada na interface o escrevia — só o lia. Sem reembolso e sem WhatsApp:
 * é anotação de agenda, não um evento pro paciente.
 *
 * Desmarcar devolve a sessão ao estado de espera fiel ao pagamento — marcar
 * errado não pode virar outro beco sem saída.
 */
export async function marcarNoShow(
  psicologoId: string, sessaoId: string, marcar: boolean,
): Promise<NoShowResult> {
  const s = await buscarSessao(sessaoId)
  if (!s || s.psicologoId !== psicologoId) return { ok: false, motivo: 'nao_encontrada' }
  if (s.assinada || s.status === 'concluida') return { ok: false, motivo: 'realizada' }
  if (s.status === 'em_curso') return { ok: false, motivo: 'em_curso' }

  const destino: SessaoStatus = marcar ? 'no_show' : statusAntesDeIniciar(s)
  await db.query(`UPDATE sessoes SET status = $3 WHERE id = $1 AND psicologo_id = $2`,
    [sessaoId, psicologoId, destino])
  return { ok: true, status: destino }
}

// ── Iniciar / Encerrar / Assinar ──────────────────────────────────────────
export async function iniciarSessao(sessaoId: string): Promise<void> {
  // iniciada_em ancora a varredura de sessões travadas (cron). Só grava na
  // PRIMEIRA entrada em curso — retomar a mesma sessão não reinicia o relógio.
  await db.query(
    `UPDATE sessoes SET status='em_curso', iniciada_em = COALESCE(iniciada_em, NOW()) WHERE id=$1`,
    [sessaoId],
  )
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
export async function gateIniciarRegistroIa(psicologoId: string, sessaoId: string): Promise<GateRegistroResult> {
  // Beta: acesso liberado — nunca bloqueia e não contabiliza cota (sem mensalidade).
  if (BETA_LIBERADO) return { ok: true }

  // WHERE inclui psicologo_id — sem isso um psicólogo poderia contabilizar/
  // estourar a cota de IA de OUTRO passando um sessaoId alheio (IDOR de cota).
  const { rows } = await db.query<{ ia_contabilizada: boolean }>(
    `SELECT ia_contabilizada FROM sessoes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [sessaoId, psicologoId],
  )
  const sessao = rows[0]
  if (!sessao) return { ok: true }                 // inexistente/não é dono: não trava o front
  if (sessao.ia_contabilizada) return { ok: true } // já contou: retomar registro é livre

  const info = await obterAssinatura(psicologoId)
  if (info.usadas >= info.cap) {
    return { ok: false, motivo: 'limite', cap: info.cap, usadas: info.usadas, plano: info.plano }
  }

  // Marca a sessão como contabilizada de forma atômica; só incrementa se ESTA
  // chamada fez a transição (evita corrida de duplo clique).
  const { rowCount } = await db.query(
    `UPDATE sessoes SET ia_contabilizada = TRUE
      WHERE id = $1 AND psicologo_id = $2 AND ia_contabilizada = FALSE`,
    [sessaoId, psicologoId],
  )
  if (rowCount) await incrementarSessaoIa(psicologoId)
  return { ok: true }
}

export async function encerrarSessao(sessaoId: string, opts: { transcricao?: string; indicadores?: any; transcricaoStats?: any } = {}): Promise<void> {
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
  if (opts.transcricaoStats) {
    patches.push(`transcricao_stats = $${params.length + 1}`)
    params.push(JSON.stringify(opts.transcricaoStats))
  }
  await db.query(`UPDATE sessoes SET ${patches.join(', ')} WHERE id=$1`, params)
  publish({ type: 'sessao.encerrada', sessaoId })
}

export type InterromperSessaoResult =
  | { ok: true; status: SessaoStatus }
  | { ok: false; motivo: 'nao_encontrada' | 'nao_iniciada' | 'tem_registro' }

/**
 * Pra onde a sessão volta ao ser interrompida. Ela não "aconteceu", então
 * precisa voltar pro estado de espera FIEL ao que já foi pago/cobrado — senão
 * uma sessão paga voltaria como 'agendada' e sumiria da fila de confirmadas.
 */
function statusAntesDeIniciar(s: Sessao): SessaoStatus {
  if (s.pagamentoStatus === 'pago') return 'confirmada'
  if (s.pagarmeOrderId && s.pagamentoStatus === 'pendente') return 'aguardando_pagamento'
  return 'agendada'
}

/**
 * Interrompe uma sessão em curso SEM virar registro clínico: a sessão começou
 * mas não aconteceu (psicóloga precisou parar no meio, paciente passou mal, a
 * aba caiu). Diferente de `encerrarSessao`, que conclui e vira prontuário.
 *
 * O que NÃO acontece aqui, de propósito:
 *  - a transcrição parcial não é gravada (o cliente simplesmente não a envia);
 *  - nenhum resumo/laudo é gerado;
 *  - nenhum WhatsApp pós-sessão é disparado ao paciente.
 *
 * O que acontece:
 *  - a sessão volta pra fila (confirmada/aguardando_pagamento/agendada) e pode
 *    ser remarcada normalmente — o pagamento fica intacto;
 *  - a cota de sessão-IA do mês é ESTORNADA (não se cobra cota do que não virou
 *    registro), de forma idempotente: só quem faz a transição TRUE→FALSE estorna.
 *
 * Guarda `tem_registro`: se já existe transcrição/nota/resumo/assinatura, isto é
 * prontuário e não se apaga — o caminho é encerrar normalmente.
 */
export async function interromperSessao(
  psicologoId: string, sessaoId: string, origem: 'psicologo' | 'cron' = 'psicologo',
): Promise<InterromperSessaoResult> {
  const s = await buscarSessao(sessaoId)
  if (!s || s.psicologoId !== psicologoId) return { ok: false, motivo: 'nao_encontrada' }
  if (s.status !== 'em_curso') return { ok: false, motivo: 'nao_iniciada' }
  if (s.assinada || s.transcricao || s.notaClinica || s.resumoIa || s.resumoCurto)
    return { ok: false, motivo: 'tem_registro' }

  const destino = statusAntesDeIniciar(s)

  // CTE numa ida só: `antes` lê (e trava) o valor ANTIGO de ia_contabilizada —
  // RETURNING devolveria o novo — e `upd` aplica a mudança. Sem isso, duplo
  // clique estornaria a cota duas vezes.
  const { rows } = await db.query<{ contabilizada: boolean | null; n: string | number }>(
    `WITH antes AS (
       SELECT ia_contabilizada FROM sessoes
        WHERE id = $1 AND psicologo_id = $2 AND status = 'em_curso'
        FOR UPDATE
     ), upd AS (
       UPDATE sessoes
          SET status = $3, ia_contabilizada = FALSE,
              interrompida_em = NOW(), interrompida_origem = $4
        WHERE id = $1 AND psicologo_id = $2 AND status = 'em_curso'
        RETURNING 1
     )
     SELECT (SELECT ia_contabilizada FROM antes) AS contabilizada,
            (SELECT count(*) FROM upd) AS n`,
    [sessaoId, psicologoId, destino, origem],
  )
  // n = 0 → outra requisição chegou primeiro; nada a fazer (idempotente).
  // count() chega como string (bigint) do node-pg; Number() não depende disso.
  if (!rows[0] || Number(rows[0].n) === 0) return { ok: false, motivo: 'nao_iniciada' }
  if (rows[0].contabilizada) await decrementarSessaoIa(psicologoId)

  publish({ type: 'sessao.encerrada', sessaoId })
  log.info('sessao.interromper', `sessão ${sessaoId} interrompida (${origem}) → ${destino}`)
  return { ok: true, status: destino }
}

/**
 * Laudos das sessões ANTERIORES (assinadas) do paciente — pra alimentar a seção
 * "Avaliação do Progresso" do laudo novo. Da mais antiga pra mais recente.
 */
export async function resumosAnteriores(
  psicologoId: string, pacienteId: string, antesDoNumero: number, limite = 3,
): Promise<{ numero: number; resumo: string }[]> {
  const { rows } = await db.query<{ numero: number; resumo_ia: string | null }>(
    `SELECT numero, resumo_ia FROM sessoes
      WHERE paciente_id = $1 AND psicologo_id = $2 AND numero < $3
        AND assinada = TRUE AND resumo_ia IS NOT NULL
      ORDER BY numero DESC LIMIT $4`,
    [pacienteId, psicologoId, antesDoNumero, limite],
  )
  return rows
    .map(r => ({ numero: r.numero, resumo: tryDecrypt(r.resumo_ia) ?? '' }))
    .filter(r => r.resumo.trim().length > 0)
    .reverse()
}

export async function salvarResumoIA(sessaoId: string, resumo: string): Promise<void> {
  await db.query(`UPDATE sessoes SET resumo_ia = $2 WHERE id = $1`, [sessaoId, encrypt(resumo)])
}

/** Resumo curto automático (fast) — rascunho do registro assinado (resumo_ia). */
export async function salvarResumoCurto(sessaoId: string, resumo: string): Promise<void> {
  await db.query(`UPDATE sessoes SET resumo_curto = $2 WHERE id = $1`, [sessaoId, encrypt(resumo)])
}

/** Laudo formal CFP (sob demanda, modelo forte) — coluna própria, separada do
 *  registro de continuidade (resumo_ia). Gerar/regerar o laudo NÃO toca o resumo. */
export async function salvarLaudo(sessaoId: string, laudo: string): Promise<void> {
  await db.query(`UPDATE sessoes SET laudo = $2 WHERE id = $1`, [sessaoId, encrypt(laudo)])
}

/**
 * Retifica o laudo de uma sessão JÁ ASSINADA: preserva a versão atual no
 * histórico (cifrada, com data) antes de gravar a nova — prontuário não apaga.
 * Não mexe na assinatura nem dispara WhatsApp. Confere posse e que está assinada.
 */
export async function editarResumoAssinado(psicologoId: string, sessaoId: string, novoResumo: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE sessoes
        SET resumo_historico = CASE WHEN resumo_ia IS NOT NULL
              THEN COALESCE(resumo_historico, '[]'::jsonb)
                   || jsonb_build_array(jsonb_build_object('texto', resumo_ia, 'em', NOW()))
              ELSE COALESCE(resumo_historico, '[]'::jsonb) END,
            resumo_ia = $3,
            resumo_editado_em = NOW()
      WHERE id = $1 AND psicologo_id = $2 AND assinada = TRUE`,
    [sessaoId, psicologoId, encrypt(novoResumo)],
  )
  return (rowCount ?? 0) > 0
}

/**
 * Salva a nota clínica privada da sessão (texto cifrado em repouso). Pode ser
 * chamada a qualquer momento — durante a revisão pós-sessão ou depois — pra
 * reter/editar as anotações do psicólogo, independente da assinatura do resumo
 * formal. Confere posse pelo psicologoId. `null`/vazio limpa a nota.
 */
export async function salvarNotaClinica(psicologoId: string, sessaoId: string, nota: string): Promise<boolean> {
  const limpa = nota.trim()
  const { rowCount } = await db.query(
    `UPDATE sessoes SET nota_clinica = $3 WHERE id = $1 AND psicologo_id = $2`,
    [sessaoId, psicologoId, limpa ? encrypt(limpa) : null],
  )
  return (rowCount ?? 0) > 0
}

export type GateImportResult =
  | { ok: true }
  | { ok: false; motivo: 'limite'; cap: number; usadas: number; plano: string }

/**
 * Gate de IMPORTAÇÃO de sessão (backfill de histórico). HOJE é pass-through
 * (beta liberado). Ponto ÚNICO onde o modelo de cobrança do import se pluga ao
 * sair do beta — ver [[auren-care-assinatura]]. Modelos possíveis (decidir 1):
 *   (a) contar na cota mensal de sessões-IA (reusa obterAssinatura/incrementarSessaoIa);
 *   (b) add-on/crédito único de "importar histórico" (contador próprio de imports);
 *   (c) cap de imports grátis por plano (Free N, Essencial M, Pro ilimitado);
 *   (d) import sem laudo/temas por padrão (custo zero) → gate só quando pedir IA.
 * Quando decidir: trocar o corpo abaixo pela checagem; a rota já trata {ok:false}.
 */
export async function gateImportarSessao(psicologoId: string, _pacienteId: string): Promise<GateImportResult> {
  if (BETA_LIBERADO) return { ok: true }
  // TODO(go-live): implementar o modelo escolhido. Esqueleto do modelo (a):
  //   const info = await obterAssinatura(psicologoId)
  //   if (info.usadas >= info.cap) return { ok: false, motivo: 'limite', cap: info.cap, usadas: info.usadas, plano: info.plano }
  return { ok: true }
}

/**
 * Importa uma transcrição externa como sessão de HISTÓRICO. Cria a sessão já
 * concluída (não assinada), salva a transcrição cifrada e gera um RASCUNHO de
 * laudo. NÃO envia WhatsApp, NÃO cobra, NÃO conta cota de IA. O psicólogo revisa
 * e assina pela tela normal — e é aí que os temas/evolução são alimentados (CFP:
 * nada vira prontuário sem assinatura). Retorna o id da sessão criada.
 */
export async function importarSessao(input: {
  psicologoId: string
  pacienteId: string
  dataHora: string
  numero?: number | null
  transcricao: string
  gerarLaudo?: boolean
}): Promise<{ sessaoId: string; numero: number; laudo: string | null }> {
  // Número: usa o informado, senão o próximo do paciente.
  let numero = input.numero ?? null
  if (numero == null) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM sessoes WHERE paciente_id = $1`,
      [input.pacienteId],
    )
    numero = rows[0].n
  }

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessoes
       (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade,
        status, valor, pagamento_status, transcricao_texto, importada)
     VALUES ($1,$2,$3,$4,$5,'online','concluida',0,'isento',$6,TRUE)
     RETURNING id`,
    [input.psicologoId, input.pacienteId, numero, input.dataHora, 50, encrypt(input.transcricao)],
  )
  const sessaoId = rows[0].id

  // Rascunho de laudo (sem cota, sem WhatsApp). Falha de IA não quebra o import —
  // o psicólogo escreve/ajusta manualmente na revisão.
  let laudo: string | null = null
  if (input.gerarLaudo !== false) {
    try {
      const sessao = await buscarSessao(sessaoId)
      if (sessao) {
        const historico = await resumosAnteriores(input.psicologoId, input.pacienteId, numero).catch(() => [])
        const { gerarLaudoFormal, iaIndisponivel } = await import('@/server/lib/anthropic')
        const r = await gerarLaudoFormal(input.transcricao, { numero, pacienteNome: sessao.pacienteNome, psicologoId: input.psicologoId, sessaoId, pacienteId: input.pacienteId }, historico)
        if (!iaIndisponivel(r)) { await salvarResumoIA(sessaoId, r); laudo = r }
      }
    } catch (err) {
      log.err('importarSessao', `falha ao gerar laudo sessao=${sessaoId}`, err)
    }
  }

  return { sessaoId, numero, laudo }
}

export async function assinarSessao(sessaoId: string): Promise<void> {
  const s = await buscarSessao(sessaoId)
  if (!s) throw new Error('sessao_nao_encontrada')
  await db.query(
    `UPDATE sessoes SET assinada = TRUE, assinatura_timestamp = NOW() WHERE id = $1`,
    [sessaoId],
  )
  // Fluxo 6 — pós-sessão. Não dispara em sessão importada (histórico): o paciente
  // não deve receber "sua sessão terminou" por uma sessão de meses atrás.
  if (!s.importada) {
    await enviarWA(s.pacienteTelefone, WA_TEMPLATES.fluxo6_posSessao(s.numero))
  }
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
