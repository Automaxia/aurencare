import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'
import { custoLlmUsd, custoAssemblyUsd, usdParaBrl, type ProviderLlm } from '@/server/lib/precos'

/**
 * Registro e agregação de custo de APIs externas. As funções de registro são
 * "best-effort": nunca lançam (um custo não-registrado não pode quebrar um fluxo).
 *
 * Atribuição obrigatória: toda chamada precisa de `psicologoId` (de quem é o gasto).
 * `psicologoId` é exigido em tempo de compilação (tipo) — custo órfão foi o problema
 * que esta instrumentação corrige. Ver migration 038.
 */

/** Natureza do gasto — como o custo escala. Derivada do scope técnico (operacao). */
export type NaturezaCusto = 'sessao' | 'ao_vivo' | 'fundo' | 'outros'

/** Mapa central operacao → natureza. Única fonte da verdade da classificação. */
export function naturezaDeOperacao(operacao?: string | null): NaturezaCusto {
  const op = operacao ?? ''
  if (op === 'assemblyai.streaming' || op === 'anthropic.resumo') return 'sessao'
  if (op.startsWith('ia.') || op === 'insight.sessao' || op === 'contexto.topicos' || op === 'sessao.anterior') return 'ao_vivo'
  if (op.startsWith('temas.grafo') || op === 'temas.validar' || op === 'marcos' || op === 'evolucao.obs' || op === 'insight.temas') return 'fundo'
  return 'outros' // chat.*, objetivos.copiloto, saude.insights, prontuario.ia, wa.voz.*, demo.*
}

/** Guard fail-loud: custo sem psicólogo é bug de instrumentação, não custo real. */
function psicologoValido(psicologoId: string | null | undefined, operacao?: string | null): psicologoId is string {
  if (psicologoId) return true
  const msg = `custo órfão bloqueado: chamada de IA sem psicologo_id (operacao=${operacao ?? '?'})`
  if (process.env.NODE_ENV !== 'production') throw new Error(msg)
  log.err('custos', msg, undefined)
  return false
}

/** Registra o custo de uma chamada de LLM (OpenAI ou Anthropic), com tokens reais. */
export async function registrarCustoLlm(input: {
  provider: ProviderLlm; operacao: string; modelo: string;
  tokensEntrada: number; tokensSaida: number;
  psicologoId: string; sessaoId?: string | null; pacienteId?: string | null;
  escopoRecalculo?: number | null; latenciaMs?: number | null;
}): Promise<void> {
  try {
    if (!psicologoValido(input.psicologoId, input.operacao)) return
    const custoUsd = custoLlmUsd(input.provider, input.modelo, input.tokensEntrada, input.tokensSaida)
    await db.query(
      `INSERT INTO api_custos (provider, operacao, natureza, modelo, psicologo_id, sessao_id, paciente_id,
                               tokens_entrada, tokens_saida, custo_usd, custo_brl, escopo_recalculo, latencia_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [input.provider, input.operacao, naturezaDeOperacao(input.operacao), input.modelo,
       input.psicologoId, input.sessaoId ?? null, input.pacienteId ?? null,
       input.tokensEntrada, input.tokensSaida, custoUsd, usdParaBrl(custoUsd), input.escopoRecalculo ?? null,
       input.latenciaMs ?? null],
    )
  } catch (err) {
    log.warn('custos', 'falha ao registrar custo llm', err instanceof Error ? err.message : err)
  }
}

/** Compat — mantido para callers antigos; delega para registrarCustoLlm. */
export async function registrarCustoAnthropic(input: {
  operacao: string; modelo: string; tokensEntrada: number; tokensSaida: number;
  psicologoId: string; sessaoId?: string | null; pacienteId?: string | null;
}): Promise<void> {
  return registrarCustoLlm({ provider: 'anthropic', ...input })
}

export async function registrarCustoAssemblyEstimado(input: {
  segundos: number; psicologoId: string; sessaoId?: string | null; pacienteId?: string | null;
  /** false quando `segundos` é a duração REAL transmitida (Tarefa 2a), não a estimativa. */
  estimado?: boolean;
}): Promise<void> {
  try {
    if (input.segundos <= 0) return
    if (!psicologoValido(input.psicologoId, 'assemblyai.streaming')) return
    const custoUsd = custoAssemblyUsd(input.segundos)
    await db.query(
      `INSERT INTO api_custos (provider, operacao, natureza, modelo, psicologo_id, sessao_id, paciente_id,
                               segundos, estimado, custo_usd, custo_brl)
       VALUES ('assemblyai', 'assemblyai.streaming', 'sessao', 'universal-streaming', $1, $2, $3, $4, $5, $6, $7)`,
      [input.psicologoId, input.sessaoId ?? null, input.pacienteId ?? null,
       Math.round(input.segundos), input.estimado ?? true, custoUsd, usdParaBrl(custoUsd)],
    )
  } catch (err) {
    log.warn('custos', 'falha ao registrar custo assemblyai', err instanceof Error ? err.message : err)
  }
}

// ── Agregações pro painel ──────────────────────────────────────────────────

export type ResumoCustos = {
  mesTotalUsd: number
  totalUsd: number
  porProviderMes: { provider: string; usd: number; estimado: boolean }[]
  porOperacaoMes: { operacao: string; provider: string; usd: number; chamadas: number }[]
  porFuncionalidadeMes: { func: string; usd: number }[]
  /** Custo do mês por natureza (sessao/ao_vivo/fundo/outros/legado). Instrumentação 038. */
  porNaturezaMes: { natureza: string; usd: number; chamadas: number }[]
  sessoesMes: number
  /** Antigo: custo total do mês ÷ sessões distintas (mistura fundo/batch — enganoso). */
  custoPorSessaoMesUsd: number | null
  /** Custo ATRIBUÍDO a sessão (natureza sessao+ao_vivo) ÷ sessões distintas com custo. */
  custoSessaoAtribuidoUsd: number | null
  /** % do custo do mês que é de fundo/batch (não escala com atendimento). */
  fundoPctMes: number | null
  primeiroRegistro: string | null
}

/** Mapeia o `scope` técnico (operacao) → funcionalidade de produto, pro custo por feature. */
const SQL_FUNCIONALIDADE = `
  CASE
    WHEN provider = 'assemblyai'                                                                          THEN 'transcricao'
    WHEN operacao IN ('prontuario.ia','marcos')                                                          THEN 'memoria'
    WHEN operacao IN ('evolucao.obs','chat.evolucao','anthropic.resumo')                                 THEN 'evolucao'
    WHEN operacao IN ('insight.temas','temas.validar','chat.temas')                                      THEN 'temas'
    WHEN operacao = 'objetivos.copiloto'                                                                  THEN 'objetivos'
    WHEN operacao = 'saude.insights'                                                                      THEN 'saude'
    WHEN operacao IN ('ia.tom','ia.risco','ia.falante','ia.marcar-turnos','ia.obs-viva','insight.sessao','contexto.topicos') THEN 'sessao'
    ELSE 'outros'
  END`

export async function resumoCustos(): Promise<ResumoCustos> {
  const [mes, total, prov, op, func, sess, primeiro, natureza, atribuido] = await Promise.all([
    db.query<{ usd: string }>(`SELECT COALESCE(SUM(custo_usd),0) AS usd FROM api_custos WHERE created_at >= date_trunc('month', NOW())`),
    db.query<{ usd: string }>(`SELECT COALESCE(SUM(custo_usd),0) AS usd FROM api_custos`),
    db.query<{ provider: string; usd: string; estimado: boolean }>(
      `SELECT provider, COALESCE(SUM(custo_usd),0) AS usd, bool_or(estimado) AS estimado
         FROM api_custos WHERE created_at >= date_trunc('month', NOW())
        GROUP BY provider ORDER BY usd DESC`),
    db.query<{ operacao: string; provider: string; usd: string; chamadas: string }>(
      `SELECT COALESCE(operacao,'(sem)') AS operacao, provider,
              COALESCE(SUM(custo_usd),0) AS usd, COUNT(*) AS chamadas
         FROM api_custos WHERE created_at >= date_trunc('month', NOW())
        GROUP BY operacao, provider ORDER BY usd DESC LIMIT 12`),
    db.query<{ func: string; usd: string }>(
      `SELECT ${SQL_FUNCIONALIDADE} AS func, COALESCE(SUM(custo_usd),0) AS usd
         FROM api_custos WHERE created_at >= date_trunc('month', NOW())
        GROUP BY 1 ORDER BY usd DESC`),
    db.query<{ n: string }>(
      `SELECT COUNT(DISTINCT sessao_id) AS n FROM api_custos
        WHERE sessao_id IS NOT NULL AND created_at >= date_trunc('month', NOW())`),
    db.query<{ ts: string | null }>(`SELECT MIN(created_at) AS ts FROM api_custos`),
    // Custo por natureza (038). Linhas legadas (pré-deploy) têm natureza NULL → 'legado'.
    db.query<{ natureza: string; usd: string; chamadas: string }>(
      `SELECT COALESCE(natureza,'legado') AS natureza, COALESCE(SUM(custo_usd),0) AS usd, COUNT(*) AS chamadas
         FROM api_custos WHERE created_at >= date_trunc('month', NOW())
        GROUP BY 1 ORDER BY usd DESC`),
    // Custo atribuído a sessão (natureza sessao+ao_vivo) e nº de sessões distintas com esse custo.
    db.query<{ usd: string; sessoes: string }>(
      `SELECT COALESCE(SUM(custo_usd),0) AS usd, COUNT(DISTINCT sessao_id) AS sessoes
         FROM api_custos
        WHERE natureza IN ('sessao','ao_vivo') AND sessao_id IS NOT NULL
          AND created_at >= date_trunc('month', NOW())`),
  ])

  const mesTotalUsd = Number(mes.rows[0].usd)
  const sessoesMes = Number(sess.rows[0].n)
  const fundoUsd = Number(natureza.rows.find(r => r.natureza === 'fundo')?.usd ?? 0)
  const atribUsd = Number(atribuido.rows[0].usd)
  const atribSess = Number(atribuido.rows[0].sessoes)
  return {
    mesTotalUsd,
    totalUsd: Number(total.rows[0].usd),
    porProviderMes: prov.rows.map(r => ({ provider: r.provider, usd: Number(r.usd), estimado: r.estimado })),
    porOperacaoMes: op.rows.map(r => ({ operacao: r.operacao, provider: r.provider, usd: Number(r.usd), chamadas: Number(r.chamadas) })),
    porFuncionalidadeMes: func.rows.map(r => ({ func: r.func, usd: Number(r.usd) })),
    porNaturezaMes: natureza.rows.map(r => ({ natureza: r.natureza, usd: Number(r.usd), chamadas: Number(r.chamadas) })),
    sessoesMes,
    custoPorSessaoMesUsd: sessoesMes > 0 ? mesTotalUsd / sessoesMes : null,
    custoSessaoAtribuidoUsd: atribSess > 0 ? atribUsd / atribSess : null,
    fundoPctMes: mesTotalUsd > 0 ? (fundoUsd / mesTotalUsd) * 100 : null,
    primeiroRegistro: primeiro.rows[0].ts,
  }
}
