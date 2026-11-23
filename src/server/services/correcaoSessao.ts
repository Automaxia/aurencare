import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'
import { formatDateBR } from '@/lib/formatters'
import { sessaoVazia, sqlTemRegistro, sqlTemCobrancaAberta } from '@/lib/sessaoExclusao'
import { TERMO_CORRECAO_VERSAO, termoCorrecao, type AcaoCorrecao } from '@/lib/termoCorrecaoSessao'
import { buscarSessao, renumerarPorData, statusAntesDeIniciar, type Sessao } from './sessoes'

/**
 * Correções de sessão COM registro clínico — ver migration 057.
 *
 *  - transferirRegistro: move o conteúdo clínico pra uma sessão de outro
 *    paciente (existente e vazia, ou criada na mesma data/hora). Agenda e
 *    pagamento da sessão de origem ficam intactos; ela volta a ficar vazia.
 *  - arquivarSessao: copia a linha pra sessoes_arquivadas e a remove.
 *
 * As duas exigem termo aceito + texto de confirmação digitado (o nome do
 * paciente da sessão) e gravam sessoes_correcoes_log na MESMA transação: não
 * existe correção sem log.
 */

/** Colunas que SÃO o registro clínico — viajam juntas na transferência. */
const COLUNAS_REGISTRO = [
  'transcricao_texto', 'resumo_ia', 'nota_clinica', 'resumo_curto', 'laudo',
  'indicadores', 'palavras_chave', 'assinada', 'assinatura_timestamp',
  'resumo_historico', 'resumo_editado_em', 'transcricao_stats', 'ia_contabilizada',
] as const

export type ContextoCorrecao = {
  sessao: Sessao
  psicologoNome: string
  crp: string
  /** Pacientes ativos (fora o da sessão) com as sessões VAZIAS que podem receber o registro. */
  destinos: Array<{ id: string; nome: string; sessoes: Array<{ id: string; numero: number; dataHora: string; status: string }> }>
}

type Auditoria = { motivo: string; confirmacao: string; ip: string | null; userAgent: string | null }

export type ResultadoCorrecao =
  | { ok: true; sessaoDestinoId?: string }
  | { ok: false; erro: string }

async function carregar(psicologoId: string, sessaoId: string) {
  const s = await buscarSessao(sessaoId)
  if (!s || s.psicologoId !== psicologoId) return null
  const { rows } = await db.query<{ nome: string; crp: string }>(
    `SELECT nome, crp FROM psicologos WHERE id = $1`, [psicologoId])
  if (!rows[0]) return null
  return { s, psicologoNome: rows[0].nome, crp: rows[0].crp }
}

export async function contextoCorrecao(psicologoId: string, sessaoId: string): Promise<ContextoCorrecao | null> {
  const base = await carregar(psicologoId, sessaoId)
  if (!base) return null
  const { rows } = await db.query<{ pid: string; nome: string; sid: string | null; numero: number | null; data_hora: string | null; status: string | null }>(
    `SELECT p.id AS pid, p.nome, s.id AS sid, s.numero, s.data_hora, s.status
       FROM pacientes p
       LEFT JOIN sessoes s ON s.paciente_id = p.id
            AND COALESCE(s.status, '') NOT IN ('em_curso', 'cancelada')
            AND NOT ${sqlTemRegistro('s')}
            AND s.data_hora BETWEEN $3::timestamptz - INTERVAL '30 days' AND $3::timestamptz + INTERVAL '30 days'
      WHERE p.psicologo_id = $1 AND p.id <> $2 AND p.status = 'ativo'
      ORDER BY p.nome ASC, s.data_hora ASC`,
    [psicologoId, base.s.pacienteId, base.s.dataHora],
  )
  const porPaciente = new Map<string, ContextoCorrecao['destinos'][number]>()
  for (const r of rows) {
    let d = porPaciente.get(r.pid)
    if (!d) { d = { id: r.pid, nome: r.nome, sessoes: [] }; porPaciente.set(r.pid, d) }
    if (r.sid) d.sessoes.push({ id: r.sid, numero: r.numero ?? 0, dataHora: new Date(r.data_hora!).toISOString(), status: r.status ?? '' })
  }
  return { sessao: base.s, psicologoNome: base.psicologoNome, crp: base.crp, destinos: [...porPaciente.values()] }
}

/** Confirmação digitada = nome do paciente que a ação afeta (sem caixa/acentos/espaços extras):
 *  na transferência, o paciente de destino; na exclusão, o paciente da sessão. */
function confere(digitado: string, esperado: string): boolean {
  const n = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return n(digitado) === n(esperado) && n(esperado).length > 0
}

function validarMotivo(a: Auditoria): string | null {
  if (a.motivo.trim().length < 10) return 'Descreva o motivo da correção (mínimo de 10 caracteres).'
  return null
}

function validarConfirmacao(a: Auditoria, nomeEsperado: string, papel: string): string | null {
  if (!confere(a.confirmacao, nomeEsperado)) return `Para confirmar, digite exatamente o nome do ${papel}: ${nomeEsperado}.`
  return null
}

async function gravarLog(
  cliente: { query: typeof db.query }, psicologoId: string, acao: AcaoCorrecao,
  p: { sessaoId: string; sessaoDestinoId?: string | null; pacienteOrigemId: string; pacienteDestinoId?: string | null; termo: string },
  a: Auditoria,
): Promise<number> {
  const { rows } = await cliente.query<{ id: number }>(
    `INSERT INTO sessoes_correcoes_log
       (psicologo_id, acao, sessao_id, sessao_destino_id, paciente_origem_id, paciente_destino_id,
        motivo, termo_versao, termo_texto, confirmacao_digitada, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [psicologoId, acao, p.sessaoId, p.sessaoDestinoId ?? null, p.pacienteOrigemId, p.pacienteDestinoId ?? null,
      a.motivo.trim().slice(0, 2000), TERMO_CORRECAO_VERSAO, p.termo, a.confirmacao.trim().slice(0, 255),
      a.ip?.slice(0, 64) ?? null, a.userAgent?.slice(0, 1000) ?? null],
  )
  return rows[0].id
}

/** Recalcula o grafo de temas dos pacientes afetados (best-effort, fora da transação). */
function recalcularTemas(...pacienteIds: string[]) {
  import('./temas').then(({ recalcularGrafo }) => {
    for (const id of pacienteIds) {
      recalcularGrafo(id).catch(err => log.warn('correcaoSessao', `falha ao recalcular grafo paciente=${id}`, err instanceof Error ? err.message : err))
    }
  }).catch(() => {})
}

export async function transferirRegistro(
  psicologoId: string, sessaoId: string,
  destino: { pacienteId: string; sessaoId?: string | null },
  a: Auditoria,
): Promise<ResultadoCorrecao> {
  const base = await carregar(psicologoId, sessaoId)
  if (!base) return { ok: false, erro: 'Sessão não encontrada.' }
  const { s } = base
  if (s.status === 'em_curso') return { ok: false, erro: 'A sessão está em curso. Encerre antes de corrigir.' }
  if (sessaoVazia(s)) return { ok: false, erro: 'Esta sessão não tem registro clínico para transferir.' }
  if (destino.pacienteId === s.pacienteId) return { ok: false, erro: 'Escolha um paciente diferente.' }
  const erroMotivo = validarMotivo(a)
  if (erroMotivo) return { ok: false, erro: erroMotivo }

  const { rows: pac } = await db.query<{ nome: string }>(
    `SELECT nome FROM pacientes WHERE id = $1 AND psicologo_id = $2 AND status = 'ativo'`,
    [destino.pacienteId, psicologoId])
  if (!pac[0]) return { ok: false, erro: 'Paciente de destino não encontrado.' }
  // Confirma com o nome de quem vai receber o registro — é a escolha que o psicólogo está fazendo.
  const erro = validarConfirmacao(a, pac[0].nome, 'paciente que vai receber a sessão')
  if (erro) return { ok: false, erro }

  const termo = termoCorrecao('transferir_registro', {
    psicologoNome: base.psicologoNome, crp: base.crp, pacienteOrigem: s.pacienteNome,
    pacienteDestino: pac[0].nome, sessaoNumero: s.numero, sessaoData: formatDateBR(s.dataHora),
  })

  const cliente = await db.connect()
  try {
    await cliente.query('BEGIN')
    // Trava a origem e confirma que ainda tem registro e não está em curso.
    const { rows: orig } = await cliente.query(
      `SELECT id FROM sessoes WHERE id = $1 AND psicologo_id = $2
          AND COALESCE(status, '') <> 'em_curso' AND ${sqlTemRegistro()} FOR UPDATE`,
      [sessaoId, psicologoId])
    if (!orig[0]) { await cliente.query('ROLLBACK'); return { ok: false, erro: 'A sessão mudou no meio do caminho. Recarregue e tente de novo.' } }

    let destinoId = destino.sessaoId ?? null
    if (destinoId) {
      // Destino precisa ser do paciente escolhido, vazio e fora de curso.
      const { rows: dst } = await cliente.query(
        `SELECT id FROM sessoes WHERE id = $1 AND paciente_id = $2 AND psicologo_id = $3
            AND COALESCE(status, '') NOT IN ('em_curso', 'cancelada') AND NOT ${sqlTemRegistro()} FOR UPDATE`,
        [destinoId, destino.pacienteId, psicologoId])
      if (!dst[0]) { await cliente.query('ROLLBACK'); return { ok: false, erro: 'A sessão de destino não está mais disponível (já tem registro ou está em curso).' } }
    } else {
      // Sem sessão escolhida: cria uma no paciente certo, mesma data/hora/formato,
      // sem cobrança (o atendimento já foi cobrado/agendado na origem).
      const { rows: nova } = await cliente.query<{ id: string }>(
        `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade,
                              status, valor, pagamento_status, iniciada_em)
         SELECT o.psicologo_id, $2,
                (SELECT COUNT(*) + 1 FROM sessoes x WHERE x.paciente_id = $2 AND x.data_hora <= o.data_hora),
                o.data_hora, o.duracao_min, o.modalidade, 'concluida', 0, 'isento', o.iniciada_em
           FROM sessoes o WHERE o.id = $1
         RETURNING id`,
        [sessaoId, destino.pacienteId])
      destinoId = nova[0].id
    }

    // Copia o registro pro destino e limpa a origem — mesmas colunas, uma ida cada.
    const sets = COLUNAS_REGISTRO.filter(c => c !== 'assinada' && c !== 'assinatura_timestamp')
      .map(c => `${c} = o.${c}`).join(', ')
    await cliente.query(
      // Volta como RASCUNHO (assinada = FALSE): o resumo/laudo foi escrito com o
      // nome e o número da sessão do paciente errado — o psicólogo revisa e reassina.
      `UPDATE sessoes d SET ${sets}, status = 'concluida', assinada = FALSE, assinatura_timestamp = NULL
         FROM sessoes o WHERE o.id = $1 AND d.id = $2`,
      [sessaoId, destinoId])
    await cliente.query(
      `UPDATE sessoes SET transcricao_texto = NULL, resumo_ia = NULL, nota_clinica = NULL,
              resumo_curto = NULL, laudo = NULL, indicadores = NULL, palavras_chave = NULL,
              assinada = FALSE, assinatura_timestamp = NULL, resumo_historico = NULL,
              resumo_editado_em = NULL, transcricao_stats = NULL, ia_contabilizada = FALSE,
              status = $2
        WHERE id = $1`,
      [sessaoId, statusAntesDeIniciar(s)])
    // O snapshot de temas da origem pertence ao paciente errado.
    await cliente.query(`DELETE FROM sessao_grafo WHERE sessao_id = $1`, [sessaoId])

    await renumerarPorData(s.pacienteId, cliente)
    await renumerarPorData(destino.pacienteId, cliente)
    await gravarLog(cliente, psicologoId, 'transferir_registro', {
      sessaoId, sessaoDestinoId: destinoId, pacienteOrigemId: s.pacienteId, pacienteDestinoId: destino.pacienteId, termo,
    }, a)
    await cliente.query('COMMIT')
    log.info('correcaoSessao', `registro transferido sessao=${sessaoId} → ${destinoId} (psicologo=${psicologoId})`)
    recalcularTemas(s.pacienteId, destino.pacienteId)
    return { ok: true, sessaoDestinoId: destinoId }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    log.err('correcaoSessao', `falha ao transferir registro sessao=${sessaoId}`, err)
    return { ok: false, erro: 'Não foi possível concluir a transferência. Nada foi alterado.' }
  } finally {
    cliente.release()
  }
}

export async function arquivarSessao(psicologoId: string, sessaoId: string, a: Auditoria): Promise<ResultadoCorrecao> {
  const base = await carregar(psicologoId, sessaoId)
  if (!base) return { ok: false, erro: 'Sessão não encontrada.' }
  const { s } = base
  if (s.status === 'em_curso') return { ok: false, erro: 'A sessão está em curso. Encerre antes de excluir.' }
  // Dinheiro preso na sessão não some junto com ela: o financeiro perderia a linha.
  if (s.pagamentoStatus === 'pago') return { ok: false, erro: 'Sessão paga: cancele/reembolse no Financeiro antes, ou transfira o registro para o paciente certo.' }
  if (s.cobrancaId && s.pagamentoStatus === 'pendente') return { ok: false, erro: 'Há uma cobrança ativa nesta sessão. Cancele a cobrança antes de excluir.' }
  const erro = validarMotivo(a) ?? validarConfirmacao(a, s.pacienteNome, 'paciente da sessão')
  if (erro) return { ok: false, erro }

  const termo = termoCorrecao('excluir', {
    psicologoNome: base.psicologoNome, crp: base.crp, pacienteOrigem: s.pacienteNome,
    sessaoNumero: s.numero, sessaoData: formatDateBR(s.dataHora),
  })

  const cliente = await db.connect()
  try {
    await cliente.query('BEGIN')
    const logId = await gravarLog(cliente, psicologoId, 'excluir', { sessaoId, pacienteOrigemId: s.pacienteId, termo }, a)
    const { rowCount: copiou } = await cliente.query(
      `INSERT INTO sessoes_arquivadas (id, psicologo_id, paciente_id, dados, correcao_id)
       SELECT id, psicologo_id, paciente_id, to_jsonb(s.*), $3 FROM sessoes s
        WHERE id = $1 AND psicologo_id = $2
          AND COALESCE(status, '') <> 'em_curso'
          AND COALESCE(pagamento_status, '') <> 'pago'
          AND NOT ${sqlTemCobrancaAberta()}`,
      [sessaoId, psicologoId, logId])
    if (!copiou) { await cliente.query('ROLLBACK'); return { ok: false, erro: 'A sessão mudou no meio do caminho. Recarregue e tente de novo.' } }
    await cliente.query(`DELETE FROM sessoes WHERE id = $1`, [sessaoId])
    await renumerarPorData(s.pacienteId, cliente)
    await cliente.query('COMMIT')
    log.info('correcaoSessao', `sessão arquivada sessao=${sessaoId} (psicologo=${psicologoId}, log=${logId})`)
    recalcularTemas(s.pacienteId)
    return { ok: true }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    log.err('correcaoSessao', `falha ao arquivar sessao=${sessaoId}`, err)
    return { ok: false, erro: 'Não foi possível excluir. Nada foi alterado.' }
  } finally {
    cliente.release()
  }
}
