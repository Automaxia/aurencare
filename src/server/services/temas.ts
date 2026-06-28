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

// Versão do prompt de extração gravada em cada snapshot (sessao_grafo). Trocar
// quando a rubrica/prompt mudar de forma relevante → permite distinguir
// "não apareceu porque não aconteceu" de "a regra da época era cega pra isso".
const VERSAO_PROMPT = 'extracao-v3'

type NoSnapshot = { nucleo: string; cluster: Cluster; reinforcement: boolean }
type ArestaSnapshot = { a: string; b: string; tipo: string | null }

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

  // Snapshot da SESSÃO (fonte da verdade). O agregado é derivado disto depois.
  const nos: NoSnapshot[] = (nodes as Array<{ term: string; cluster: Cluster; reinforcement: boolean }>)
    .map(n => ({ nucleo: n.term, cluster: n.cluster, reinforcement: n.reinforcement }))
  const arestas: ArestaSnapshot[] = (edges as Array<{ source: string; target: string; tipo: string | null }>)
    .map(e => {
      const [a, b] = e.source < e.target ? [e.source, e.target] : [e.target, e.source]
      return { a, b, tipo: e.tipo }
    })

  // sessao_num vem do banco (subquery) → não precisa mudar a assinatura do caller.
  await db.query(
    `INSERT INTO sessao_grafo (paciente_id, sessao_id, sessao_num, versao_prompt, versao_conceitualizacao, nos, arestas, criado_em)
     VALUES ($1, $2::uuid, (SELECT numero FROM sessoes WHERE id = $2::uuid), $3, $4, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (paciente_id, sessao_id) DO UPDATE SET
       sessao_num = EXCLUDED.sessao_num,
       versao_prompt = EXCLUDED.versao_prompt,
       versao_conceitualizacao = EXCLUDED.versao_conceitualizacao,
       nos = EXCLUDED.nos, arestas = EXCLUDED.arestas, criado_em = NOW()`,
    [opts.pacienteId, opts.sessaoId, VERSAO_PROMPT, null, JSON.stringify(nos), JSON.stringify(arestas)],
  )
  return { palavrasInseridas: nos.length, arestasInseridas: arestas.length }
}

/**
 * Deriva o agregado (palavras_chave/arestas_tema) a partir dos snapshots por
 * sessão. Recorrência = nº de sessões DISTINTAS em que o nó/aresta aparece
 * (contada do store, não inferida pelo LLM — §7.4). cluster/tipo seguem a
 * sessão mais recente. Reescreve o agregado inteiro do paciente.
 */
async function derivarAgregado(pacienteId: string): Promise<void> {
  const { rows } = await db.query<{ sessao_id: string; sessao_num: number | null; nos: any; arestas: any }>(
    `SELECT sessao_id, sessao_num, nos, arestas FROM sessao_grafo WHERE paciente_id = $1 ORDER BY sessao_num ASC NULLS FIRST`,
    [pacienteId],
  )
  const nodeMap = new Map<string, { cluster: string; sessoes: Set<string>; ultimaNum: number; ultimaSessao: string }>()
  const edgeMap = new Map<string, { a: string; b: string; tipo: string | null; sessoes: Set<string>; ultimaNum: number }>()
  for (const r of rows) {
    const num = r.sessao_num ?? 0
    for (const n of (Array.isArray(r.nos) ? r.nos : [])) {
      const nucleo = String(n?.nucleo ?? '').trim()
      if (!nucleo) continue
      let e = nodeMap.get(nucleo)
      if (!e) { e = { cluster: n?.cluster ?? 'cognitivo', sessoes: new Set(), ultimaNum: -1, ultimaSessao: r.sessao_id }; nodeMap.set(nucleo, e) }
      e.sessoes.add(r.sessao_id)
      if (num >= e.ultimaNum) { e.ultimaNum = num; if (n?.cluster) e.cluster = n.cluster; e.ultimaSessao = r.sessao_id }
    }
    for (const a of (Array.isArray(r.arestas) ? r.arestas : [])) {
      const x = String(a?.a ?? '').trim(), y = String(a?.b ?? '').trim()
      if (!x || !y) continue
      const key = x + '\u0001' + y
      let e = edgeMap.get(key)
      if (!e) { e = { a: x, b: y, tipo: a?.tipo ?? null, sessoes: new Set(), ultimaNum: -1 }; edgeMap.set(key, e) }
      e.sessoes.add(r.sessao_id)
      if (num >= e.ultimaNum) { e.ultimaNum = num; if (a?.tipo) e.tipo = a.tipo }
    }
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM palavras_chave WHERE paciente_id = $1`, [pacienteId])
    await client.query(`DELETE FROM arestas_tema   WHERE paciente_id = $1`, [pacienteId])
    for (const [nucleo, e] of nodeMap) {
      await client.query(
        `INSERT INTO palavras_chave (paciente_id, palavra, cluster, frequencia, ultima_sessao_id, sessoes_ids, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid, $6::jsonb, NOW())`,
        [pacienteId, nucleo, e.cluster, e.sessoes.size, e.ultimaSessao, JSON.stringify([...e.sessoes])],
      )
    }
    for (const e of edgeMap.values()) {
      await client.query(
        `INSERT INTO arestas_tema (paciente_id, palavra_a, palavra_b, weight, tipo, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [pacienteId, e.a, e.b, e.sessoes.size, e.tipo],
      )
    }
    await client.query('COMMIT')
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
  if (r) {
    // Snapshot gravado → re-deriva o agregado do paciente a partir do store.
    try { await derivarAgregado(opts.pacienteId) } catch (err) {
      console.warn(`[temas.grafo] falha ao derivar agregado paciente=${opts.pacienteId}:`, err)
    }
    return r
  }
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

  await db.query(`DELETE FROM sessao_grafo   WHERE paciente_id = $1`, [pacienteId])
  await db.query(`DELETE FROM arestas_tema   WHERE paciente_id = $1`, [pacienteId])
  await db.query(`DELETE FROM palavras_chave WHERE paciente_id = $1`, [pacienteId])

  const { rows: sessoes } = await db.query<{ id: string; transcricao_texto: string | null; resumo_ia: string | null }>(
    `SELECT id, transcricao_texto, resumo_ia
       FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora ASC`,
    [pacienteId],
  )

  // Grava o snapshot de cada sessão (sem derivar a cada uma)…
  for (const s of sessoes) {
    const tx = tryDecrypt(s.transcricao_texto) ?? tryDecrypt(s.resumo_ia) ?? ''
    if (!tx) continue
    try { await extrairTemasComIA({ pacienteId, sessaoId: s.id, transcricao: tx }) }
    catch (err) { console.warn(`[temas.grafo] falha extração sessao=${s.id} no recálculo:`, err) }
  }
  // …e deriva o agregado uma única vez a partir do store completo.
  await derivarAgregado(pacienteId)

  const { rows: count } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM palavras_chave WHERE paciente_id = $1`, [pacienteId],
  )
  return { sessoes: sessoes.length, nodes: count[0].n }
}

/**
 * Manutenção / backfill: recalcula o grafo de TODOS os pacientes com ao menos
 * uma sessão assinada — popula o store por-sessão (sessao_grafo) e deriva o
 * agregado. Idempotente e reexecutável. Sequencial pra não saturar a IA.
 */
export async function recalcularGrafosTodos(): Promise<{
  pacientes: number
  resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }>
}> {
  const { rows } = await db.query<{ paciente_id: string }>(
    `SELECT DISTINCT paciente_id FROM sessoes WHERE assinada = TRUE`,
  )
  const resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }> = []
  for (const { paciente_id } of rows) {
    const r = await recalcularGrafo(paciente_id)
    resultados.push({ pacienteId: paciente_id, ...r })
  }
  return { pacientes: rows.length, resultados }
}
