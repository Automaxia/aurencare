import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'
import { custoAnthropicUsd, custoAssemblyUsd } from '@/server/lib/precos'

/**
 * Registro e agregação de custo de APIs externas. As funções de registro são
 * "best-effort": nunca lançam (um custo não-registrado não pode quebrar um fluxo).
 */

export async function registrarCustoAnthropic(input: {
  operacao?: string; modelo: string; tokensEntrada: number; tokensSaida: number;
  psicologoId?: string | null; sessaoId?: string | null;
}): Promise<void> {
  try {
    const custo = custoAnthropicUsd(input.modelo, input.tokensEntrada, input.tokensSaida)
    await db.query(
      `INSERT INTO api_custos (provider, operacao, modelo, psicologo_id, sessao_id, tokens_entrada, tokens_saida, custo_usd)
       VALUES ('anthropic', $1, $2, $3, $4, $5, $6, $7)`,
      [input.operacao ?? null, input.modelo, input.psicologoId ?? null, input.sessaoId ?? null,
       input.tokensEntrada, input.tokensSaida, custo],
    )
  } catch (err) {
    log.warn('custos', 'falha ao registrar custo anthropic', err instanceof Error ? err.message : err)
  }
}

export async function registrarCustoAssemblyEstimado(input: {
  segundos: number; psicologoId?: string | null; sessaoId?: string | null;
}): Promise<void> {
  try {
    if (input.segundos <= 0) return
    const custo = custoAssemblyUsd(input.segundos)
    await db.query(
      `INSERT INTO api_custos (provider, operacao, modelo, psicologo_id, sessao_id, segundos, estimado, custo_usd)
       VALUES ('assemblyai', 'assemblyai.streaming', 'universal-streaming', $1, $2, $3, TRUE, $4)`,
      [input.psicologoId ?? null, input.sessaoId ?? null, Math.round(input.segundos), custo],
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
  sessoesMes: number
  custoPorSessaoMesUsd: number | null
  primeiroRegistro: string | null
}

export async function resumoCustos(): Promise<ResumoCustos> {
  const [mes, total, prov, op, sess, primeiro] = await Promise.all([
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
    db.query<{ n: string }>(
      `SELECT COUNT(DISTINCT sessao_id) AS n FROM api_custos
        WHERE sessao_id IS NOT NULL AND created_at >= date_trunc('month', NOW())`),
    db.query<{ ts: string | null }>(`SELECT MIN(created_at) AS ts FROM api_custos`),
  ])

  const mesTotalUsd = Number(mes.rows[0].usd)
  const sessoesMes = Number(sess.rows[0].n)
  return {
    mesTotalUsd,
    totalUsd: Number(total.rows[0].usd),
    porProviderMes: prov.rows.map(r => ({ provider: r.provider, usd: Number(r.usd), estimado: r.estimado })),
    porOperacaoMes: op.rows.map(r => ({ operacao: r.operacao, provider: r.provider, usd: Number(r.usd), chamadas: Number(r.chamadas) })),
    sessoesMes,
    custoPorSessaoMesUsd: sessoesMes > 0 ? mesTotalUsd / sessoesMes : null,
    primeiroRegistro: primeiro.rows[0].ts,
  }
}
