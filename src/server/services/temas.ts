import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Extração de temas (nós + arestas) das falas do paciente para o grafo.
 * §8: clusters emocional · relacional · situacional · cognitivo.
 *
 * Estratégia: extração SEMÂNTICA via IA (MODE: GRAPH) — construtos clínicos,
 * não palavras. Fail-closed: se a IA falhar, não grava nada. O antigo fallback
 * por contagem de tokens foi removido porque poluía o grafo clínico com
 * fragmentos gramaticais ("estava", "menos", "nessa") que pareciam análise mas
 * eram só frequência de palavra.
 */

export type Cluster = 'emocional' | 'relacional' | 'situacional' | 'cognitivo'

/**
 * Mantém só as falas do PACIENTE para a análise de temas.
 * O transcript é salvo como linhas "P: ..." (psicóloga) e "C: ..." (cliente).
 * Se houver linhas marcadas, retorna apenas as "C:" (sem o prefixo). Se o texto
 * não tiver marcação de falante (ex.: resumo da IA), retorna como veio.
 */
function somenteFalasDoPaciente(transcricao: string): string {
  const linhas = transcricao.split('\n')
  const doPaciente = linhas
    .filter(l => /^\s*C:\s/.test(l))
    .map(l => l.replace(/^\s*C:\s/, ''))
  if (doPaciente.length > 0) return doPaciente.join('\n')
  // Sem rótulos de falante — não dá pra separar; usa o texto inteiro.
  const temRotulos = linhas.some(l => /^\s*[PC]:\s/.test(l))
  return temRotulos ? '' : transcricao
}

// As 10 categorias do MODE: GRAPH → os 4 clusters da viz (cores do §8).
const CAT_TO_CLUSTER: Record<string, Cluster> = {
  emotion: 'emocional', somatic: 'emocional',
  relationship: 'relacional',
  life_domain: 'situacional', life_event: 'situacional',
  cognition: 'cognitivo', self_concept: 'cognitivo', coping: 'cognitivo',
  value_need: 'cognitivo', behavior: 'cognitivo',
}

// Prompt MODE: GRAPH (psychotherapy_model_prompt.md) — extração semântica das
// falas do PACIENTE: nós clinicamente relevantes + relações tipadas. Precisão > recall.
const GRAPH_PROMPT = `You build a semantic graph from a psychotherapy patient's speech. From the transcript, extract only CLINICALLY SIGNIFICANT terms (nodes) and their relationships (edges). Precision over recall: few meaningful nodes beat many noisy ones.

STRICT: process only patient speech (the input is already patient-only). Ignore filler/discourse markers (então, né, tipo, sabe, na verdade…), pure connectors (mas, porque, aí…), administrative/logistics, small talk, purely factual narrative with no emotional/pattern load, and bare time words.

Node categories (use EXACTLY one): emotion, somatic, cognition, behavior, relationship, life_domain, value_need, life_event, coping, self_concept.
- relationship names (mãe, pai, chefe): include ONLY when carrying pattern/emotional charge.
- a term that recurs → mark "reinforcement": true (don't duplicate it).

Edge types (use EXACTLY one): causes, co-occurs, identity, avoidance, amplifies, contrasts, temporal. Only emit an edge with confidence ≥ 0.6, and both endpoints MUST be present in nodes.

Terms: Brazilian Portuguese, lowercase, short canonical form (e.g., "ansiedade", "mãe", "evitação", "não sou capaz").

Return ONLY JSON (no prose, no markdown), processing the ENTIRE transcript as one session:
{ "nodes": [ { "term": "...", "category": "...", "reinforcement": false } ], "edges": [ { "source": "...", "target": "...", "type": "..." } ] }
If nothing clinically relevant: { "nodes": [], "edges": [] }`

/** Extração via IA (MODE: GRAPH). Retorna null em falha (erro de API ou JSON
 *  inválido/truncado); o chamador faz fail-closed (não grava nada). */
async function extrairTemasComIA(opts: { pacienteId: string; sessaoId: string; transcricao: string }): Promise<{ palavrasInseridas: number; arestasInseridas: number } | null> {
  const texto = somenteFalasDoPaciente(opts.transcricao).slice(0, 40_000)
  if (!texto.trim()) return { palavrasInseridas: 0, arestasInseridas: 0 }

  const { chat } = await import('@/server/lib/anthropic')
  const user = `<chunk>\n  <speaker>patient</speaker>\n  <text>\n${texto}\n  </text>\n</chunk>`
  // maxTokens folgado: sessões densas geram JSON maior; o teto antigo de 1500
  // truncava o JSON das maiores → parse falhava → caía no contador de tokens.
  // 1 retry cobre erro transitório de API / truncamento pontual.
  let parsed: any = null
  for (let tentativa = 1; tentativa <= 2 && !parsed; tentativa++) {
    let raw: string
    try {
      raw = await chat(GRAPH_PROMPT, [{ role: 'user', content: user }], { scope: 'temas.grafo', maxTokens: 4000, model: 'fast' })
    } catch (err) {
      console.warn(`[temas.grafo] chamada IA falhou (tentativa ${tentativa}/2) sessao=${opts.sessaoId}:`, err)
      continue
    }
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      const p = m ? JSON.parse(m[0]) : null
      if (p && Array.isArray(p.nodes)) parsed = p
      else console.warn(`[temas.grafo] resposta sem nodes válidos (tentativa ${tentativa}/2) sessao=${opts.sessaoId}`)
    } catch {
      console.warn(`[temas.grafo] JSON inválido/truncado (tentativa ${tentativa}/2) sessao=${opts.sessaoId}`)
    }
  }
  if (!parsed) return null

  const nodes = parsed.nodes
    .map((n: any) => ({
      term: String(n?.term ?? '').toLowerCase().trim(),
      cluster: CAT_TO_CLUSTER[String(n?.category ?? '').toLowerCase()] ?? 'cognitivo',
      reinforcement: !!n?.reinforcement,
    }))
    .filter((n: { term: string }) => n.term.length >= 2 && n.term.length <= 40)
  if (nodes.length === 0) return null

  const termSet = new Set(nodes.map((n: { term: string }) => n.term))
  const edges = (Array.isArray(parsed.edges) ? parsed.edges : [])
    .map((e: any) => ({
      source: String(e?.source ?? '').toLowerCase().trim(),
      target: String(e?.target ?? '').toLowerCase().trim(),
      tipo: String(e?.type ?? '').toLowerCase().trim() || null,
    }))
    .filter((e: { source: string; target: string }) => e.source && e.target && e.source !== e.target && termSet.has(e.source) && termSet.has(e.target))

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const n of nodes as Array<{ term: string; cluster: Cluster; reinforcement: boolean }>) {
      await client.query(
        `INSERT INTO palavras_chave (paciente_id, palavra, cluster, frequencia, ultima_sessao_id, sessoes_ids, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid, jsonb_build_array($6::text), NOW())
         ON CONFLICT (paciente_id, palavra) DO UPDATE SET
           frequencia = palavras_chave.frequencia + EXCLUDED.frequencia,
           cluster = EXCLUDED.cluster,
           ultima_sessao_id = EXCLUDED.ultima_sessao_id,
           sessoes_ids = CASE WHEN palavras_chave.sessoes_ids @> jsonb_build_array($6::text)
                              THEN palavras_chave.sessoes_ids
                              ELSE palavras_chave.sessoes_ids || jsonb_build_array($6::text) END,
           updated_at = NOW()`,
        [opts.pacienteId, n.term, n.cluster, n.reinforcement ? 2 : 1, opts.sessaoId, opts.sessaoId],
      )
    }
    let arestas = 0
    for (const e of edges as Array<{ source: string; target: string; tipo: string | null }>) {
      const [a, b] = e.source < e.target ? [e.source, e.target] : [e.target, e.source]
      await client.query(
        `INSERT INTO arestas_tema (paciente_id, palavra_a, palavra_b, weight, tipo, updated_at)
         VALUES ($1, $2, $3, 1, $4, NOW())
         ON CONFLICT (paciente_id, palavra_a, palavra_b)
         DO UPDATE SET weight = arestas_tema.weight + 1, tipo = COALESCE(EXCLUDED.tipo, arestas_tema.tipo), updated_at = NOW()`,
        [opts.pacienteId, a, b, e.tipo],
      )
      arestas++
    }
    await client.query('COMMIT')
    return { palavrasInseridas: nodes.length, arestasInseridas: arestas }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Extrai temas da sessão via IA (MODE: GRAPH).
 *
 * Fail-closed: se a IA falhar (erro de API, JSON truncado/inválido), NÃO grava
 * nada — mostrar o grafo vazio é melhor que poluí-lo com ruído de token. A
 * extração é reexecutável depois via recalcularGrafo().
 */
export async function extrairTemasDaSessao(opts: {
  pacienteId: string
  sessaoId: string
  transcricao: string
}): Promise<{ palavrasInseridas: number; arestasInseridas: number }> {
  let r: { palavrasInseridas: number; arestasInseridas: number } | null = null
  try {
    r = await extrairTemasComIA(opts)
  } catch (err) {
    console.warn(`[temas.grafo] extração lançou erro sessao=${opts.sessaoId}:`, err)
  }
  if (r) return r
  // Fail-closed: IA indisponível/sem JSON válido → não grava nós.
  console.warn(`[temas.grafo] sem resultado de IA sessao=${opts.sessaoId} — grafo não atualizado (fail-closed)`)
  return { palavrasInseridas: 0, arestasInseridas: 0 }
}

// ── Leitura agregada para o grafo ─────────────────────────────────────────
export type GrafoNode  = { palavra: string; cluster: Cluster; frequencia: number; sessoesIds: string[] }
export type GrafoEdge  = { a: string; b: string; weight: number; tipo?: string | null }
export type GrafoDados = { nodes: GrafoNode[]; edges: GrafoEdge[] }

export async function lerGrafo(pacienteId: string): Promise<GrafoDados> {
  const { rows } = await db.query<{ palavra: string; cluster: Cluster; frequencia: number; sessoes_ids: string[] | null }>(
    // Extração via IA já filtra relevância (precisão > recall), então o nó entra
    // a partir de 1 ocorrência — antes o piso (freq≥3 + recorrência) escondia
    // quase tudo nas primeiras sessões. Cap em 40 nós pra ficar legível.
    `SELECT palavra, cluster, frequencia, sessoes_ids
       FROM palavras_chave
      WHERE paciente_id = $1 AND frequencia >= 1
      ORDER BY frequencia DESC
      LIMIT 40`,
    [pacienteId],
  )
  const nodes: GrafoNode[] = rows.map(r => ({
    palavra: r.palavra,
    cluster: r.cluster,
    frequencia: r.frequencia,
    sessoesIds: Array.isArray(r.sessoes_ids) ? r.sessoes_ids : [],
  }))
  if (nodes.length === 0) return { nodes: [], edges: [] }
  const palavraSet = new Set(nodes.map(n => n.palavra))

  const { rows: edges } = await db.query<{ palavra_a: string; palavra_b: string; weight: number; tipo: string | null }>(
    // Relações vêm da IA (tipadas, confiança ≥0.6), então valem a partir de 1 —
    // o piso antigo (≥2 co-ocorrências) zerava as arestas em poucas sessões.
    `SELECT palavra_a, palavra_b, weight, tipo
       FROM arestas_tema
      WHERE paciente_id = $1 AND weight >= 1
      ORDER BY weight DESC
      LIMIT 120`,
    [pacienteId],
  )

  return {
    nodes,
    edges: edges
      .filter(e => palavraSet.has(e.palavra_a) && palavraSet.has(e.palavra_b))
      .map(e => ({ a: e.palavra_a, b: e.palavra_b, weight: e.weight, tipo: e.tipo })),
  }
}

/**
 * Recalcula tudo a partir das sessões assinadas (idempotente).
 */
export async function recalcularGrafo(pacienteId: string): Promise<{ sessoes: number; nodes: number }> {
  const { tryDecrypt } = await import('@/server/lib/crypto')
  const { redis } = await import('@/server/lib/redis')

  // invalida cache do auto-insight
  const r = await redis()
  if (r) await r.del(`temas-insight:${pacienteId}`)

  await db.query(`DELETE FROM arestas_tema   WHERE paciente_id = $1`, [pacienteId])
  await db.query(`DELETE FROM palavras_chave WHERE paciente_id = $1`, [pacienteId])

  const { rows: sessoes } = await db.query<{ id: string; transcricao_texto: string | null; resumo_ia: string | null }>(
    `SELECT id, transcricao_texto, resumo_ia
       FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora ASC`,
    [pacienteId],
  )

  for (const s of sessoes) {
    const tx = tryDecrypt(s.transcricao_texto) ?? tryDecrypt(s.resumo_ia) ?? ''
    if (tx) await extrairTemasDaSessao({ pacienteId, sessaoId: s.id, transcricao: tx })
  }

  // (A extração já é via IA com filtro de relevância — sem passo de validação extra.)

  const { rows: count } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM palavras_chave WHERE paciente_id = $1`, [pacienteId],
  )
  return { sessoes: sessoes.length, nodes: count[0].n }
}

/**
 * Manutenção (one-off pós-deploy): recalcula o grafo dos pacientes cujo grafo
 * tem origem heurística — aresta sem `tipo` (o contador nunca preenchia tipo) ou
 * nó com `frequencia >= 3` (a IA grava só 1–2). Purga o ruído de token e
 * reextrai via IA. Idempotente e reexecutável. Sequencial pra não saturar a IA.
 */
export async function recalcularGrafosHeuristicos(): Promise<{
  pacientes: number
  resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }>
}> {
  const { rows } = await db.query<{ paciente_id: string }>(
    `SELECT DISTINCT pc.paciente_id
       FROM palavras_chave pc
      WHERE EXISTS (SELECT 1 FROM arestas_tema a
                     WHERE a.paciente_id = pc.paciente_id AND a.tipo IS NULL)
         OR EXISTS (SELECT 1 FROM palavras_chave p2
                     WHERE p2.paciente_id = pc.paciente_id AND p2.frequencia >= 3)`,
  )
  const resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }> = []
  for (const { paciente_id } of rows) {
    const r = await recalcularGrafo(paciente_id)
    resultados.push({ pacienteId: paciente_id, ...r })
  }
  return { pacientes: rows.length, resultados }
}
