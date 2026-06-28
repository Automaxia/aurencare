import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Inteligência Clínica Longitudinal — extração de CONSTRUTOS (não palavras) das
 * falas do paciente para o grafo. §4–§7 da spec.
 *
 * - Store por-sessão (sessao_grafo) é a fonte da verdade; o agregado
 *   (palavras_chave/arestas_tema) é DERIVADO dele, com recorrência contada
 *   (nº de sessões), não inferida pelo LLM (§7.4).
 * - Dois modos: Clínico (aplica a rubrica, pontua relevância) e Amplo (só corta
 *   ruído, captura generosamente). Cada um com seu prompt (§7.1/§7.2).
 * - Fail-closed: se a IA falhar, não grava nada.
 */

export type Cluster = 'emocional' | 'relacional' | 'situacional' | 'cognitivo'
export type Modo = 'clinico' | 'amplo'

// Threshold/teto por modo (configuráveis; calibrar contra sessões reais — §7).
const TEMAS_CONFIG: Record<Modo, { threshold: number; teto: number }> = {
  clinico: { threshold: 0.2, teto: 18 },
  amplo:   { threshold: 0,   teto: 28 },
}

function normalizarCategoria(c: string): Cluster {
  const v = (c || '').toLowerCase().trim()
  if (v.startsWith('emoc')) return 'emocional'
  if (v.startsWith('relac')) return 'relacional'
  if (v.startsWith('situ')) return 'situacional'
  return 'cognitivo'
}

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

// ── Prompts de extração (§7) ───────────────────────────────────────────────
const BLOCO_UNIDADE = `UNIDADE (vale sempre):
- "nucleo": rótulo do nó, o menor possível, idealmente UMA palavra. NUNCA verbo conjugado, conectivo ou fragmento ("estava", "comecei", "menos", "amigo" solto).
- "construto": a descrição clínica completa por trás do nó (ex.: "culpa por afastamento de amigo").
- "contextos": situações/gatilhos onde o construto aparece (frases curtas).
- Fusão por núcleo: dois construtos com o mesmo núcleo funcional (duas formas de "culpa") viram UM nó (mesmo "nucleo"), acumulando contextos.`

const BLOCO_RELACOES = `RELAÇÕES: mapeie como os construtos se ligam DENTRO da sessão. A maioria deve conectar-se a pelo menos um outro. Use uma relação específica em "relacao": "leva a", "alimenta", "justifica", "evita", "mascara", "precede", "reforça", "contradiz". Ambos os endpoints ("de"/"para") DEVEM existir em "nos".`

const BLOCO_SAIDA = `"categoria": exatamente uma de Emocional | Relacional | Situacional | Cognitivo.

Responda SÓ JSON (sem prosa, sem markdown):
{ "nos": [ { "nucleo": "...", "construto": "...", "categoria": "Emocional", "relevancia": 0.0, "contextos": ["..."], "fora_da_conceitualizacao": false } ], "arestas": [ { "de": "...", "para": "...", "relacao": "leva a" } ] }
Se nada relevante: { "nos": [], "arestas": [] }`

function promptClinico(threshold: number, teto: number): string {
  return `Você extrai os construtos clinicamente relevantes da transcrição de UMA sessão de psicoterapia e mapeia as relações entre eles, para montar um grafo.

OBJETIVO: capturar os construtos com significado clínico e como se relacionam. O grafo traz à tona o que pode ter passado despercebido — inclusive coisas claras que o terapeuta não reteve por estar focado em outra coisa.

${BLOCO_UNIDADE}

RUBRICA — relevante se carregar UM OU MAIS: carga afetiva; recorrência/padrão; ligação com queixa/objetivo; dinâmica relacional; padrão cognitivo (crença, pensamento automático, distorção, regra); movimento vs. estagnação; evitação/minimização; impacto funcional.
DESCARTAR: logística (agenda, pagamento, atraso); conversa social; tecido narrativo e conectivos; fragmentos gramaticais e verbos soltos; menção factual única sem carga.

${BLOCO_RELACOES}

MENOS É MAIS = cortar RUÍDO, não conteúdo clínico real. Se procrastinação, culpa e autocrítica são todas relevantes, inclua TODAS.

CALIBRAÇÃO: só construtos com "relevancia" ≥ ${threshold} (escala 0–1); no máximo ${teto} nós.

${BLOCO_SAIDA}`
}

function promptAmplo(teto: number): string {
  return `Você extrai TODOS os construtos com sentido próprio da transcrição, deixando a seleção do que importa para o psicólogo. Capture amplamente; só não deixe virar bagunça.

${BLOCO_UNIDADE}

FILTRO — SOMENTE RUÍDO (NÃO julgue relevância clínica):
Inclua todo construto, tema ou palavra-conteúdo com sentido próprio.
Exclua APENAS: verbos conjugados soltos e fragmentos ("estava", "fui"); conectivos e tecido narrativo ("aí", "então", "tipo"); logística (agenda, pagamento); palavras funcionais vazias. Na dúvida sobre algo que TEM sentido, INCLUA.

${BLOCO_RELACOES}

CALIBRAÇÃO: no máximo ${teto} nós; SEM corte de relevância ("relevancia" pode ser 0).

${BLOCO_SAIDA}`
}

/**
 * Parser tolerante a truncamento (§9): recupera os objetos COMPLETOS de um array
 * JSON nomeado, mesmo se a resposta vier cortada no meio. Em vez de descartar
 * tudo quando o JSON não fecha, varre os `{...}` balanceados até o corte.
 */
function objetosDeArray(raw: string, chave: string): any[] {
  const i = raw.indexOf(`"${chave}"`)
  if (i < 0) return []
  const lb = raw.indexOf('[', i)
  if (lb < 0) return []
  const out: any[] = []
  let depth = 0, start = -1, inStr = false, esc = false
  for (let k = lb + 1; k < raw.length; k++) {
    const ch = raw[k]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') { if (depth === 0) start = k; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(raw.slice(start, k + 1))) } catch { /* objeto ruim → ignora */ }
        start = -1
      }
    } else if (ch === ']' && depth === 0) break
  }
  return out
}

// Snapshot por sessão (rico). Forward-compatible: campos novos entram no jsonb.
type NoSnapshot = { nucleo: string; construto: string | null; cluster: Cluster; relevancia: number; contextos: string[]; fora: boolean }
type ArestaSnapshot = { de: string; para: string; relacao: string | null }

/**
 * Extrai o grafo de UMA sessão via IA e grava o snapshot em sessao_grafo.
 * Retorna null em falha (erro de API ou JSON irrecuperável); o chamador faz
 * fail-closed. NÃO deriva o agregado — quem chama decide quando derivar.
 */
async function extrairTemasComIA(
  opts: { pacienteId: string; sessaoId: string; transcricao: string },
  modo: Modo = 'clinico',
): Promise<{ palavrasInseridas: number; arestasInseridas: number } | null> {
  const texto = somenteFalasDoPaciente(opts.transcricao).slice(0, 40_000)
  if (!texto.trim()) return { palavrasInseridas: 0, arestasInseridas: 0 }

  const { threshold, teto } = TEMAS_CONFIG[modo]
  const system = modo === 'amplo' ? promptAmplo(teto) : promptClinico(threshold, teto)
  const { chat } = await import('@/server/lib/anthropic')
  const user = `<chunk>\n  <speaker>patient</speaker>\n  <text>\n${texto}\n  </text>\n</chunk>`

  // maxTokens folgado + 1 retry; parser tolerante recupera objetos completos
  // mesmo se o JSON truncar.
  let nosRaw: any[] = [], arestasRaw: any[] = [], ok = false
  for (let tentativa = 1; tentativa <= 2 && !ok; tentativa++) {
    let raw: string
    try {
      raw = await chat(system, [{ role: 'user', content: user }], { scope: `temas.grafo.${modo}`, maxTokens: 4000, model: 'fast' })
    } catch (err) {
      console.warn(`[temas.grafo] IA falhou (${tentativa}/2) sessao=${opts.sessaoId}:`, err)
      continue
    }
    nosRaw = objetosDeArray(raw, 'nos')
    arestasRaw = objetosDeArray(raw, 'arestas')
    if (nosRaw.length > 0 || /"nos"\s*:\s*\[\s*\]/.test(raw)) ok = true
    else console.warn(`[temas.grafo] sem nós parseáveis (${tentativa}/2) sessao=${opts.sessaoId}`)
  }
  if (!ok) return null

  // Fusão por núcleo dentro da própria sessão (§5) + normalização.
  const porNucleo = new Map<string, NoSnapshot>()
  for (const n of nosRaw) {
    const nucleo = String(n?.nucleo ?? '').toLowerCase().trim()
    if (nucleo.length < 2 || nucleo.length > 40) continue
    const novo: NoSnapshot = {
      nucleo,
      construto: n?.construto ? String(n.construto).trim() : null,
      cluster: normalizarCategoria(String(n?.categoria ?? '')),
      relevancia: Math.max(0, Math.min(1, Number(n?.relevancia) || 0)),
      contextos: Array.isArray(n?.contextos) ? n.contextos.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 8) : [],
      fora: !!n?.fora_da_conceitualizacao,
    }
    const ex = porNucleo.get(nucleo)
    if (!ex) { porNucleo.set(nucleo, novo); continue }
    ex.contextos = Array.from(new Set([...ex.contextos, ...novo.contextos])).slice(0, 8)
    ex.relevancia = Math.max(ex.relevancia, novo.relevancia)
    ex.fora = ex.fora || novo.fora
    if (!ex.construto && novo.construto) ex.construto = novo.construto
  }
  const nos = [...porNucleo.values()]
  if (nos.length === 0) return null

  const nucleoSet = new Set(nos.map(n => n.nucleo))
  const arestas: ArestaSnapshot[] = arestasRaw
    .map((e: any) => ({
      de: String(e?.de ?? '').toLowerCase().trim(),
      para: String(e?.para ?? '').toLowerCase().trim(),
      relacao: e?.relacao ? String(e.relacao).toLowerCase().trim() : null,
    }))
    .filter(e => e.de && e.para && e.de !== e.para && nucleoSet.has(e.de) && nucleoSet.has(e.para))

  // sessao_num vem do banco (subquery) → não precisa mudar a assinatura do caller.
  await db.query(
    `INSERT INTO sessao_grafo (paciente_id, sessao_id, sessao_num, versao_prompt, versao_conceitualizacao, nos, arestas, criado_em)
     VALUES ($1, $2::uuid, (SELECT numero FROM sessoes WHERE id = $2::uuid), $3, $4, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (paciente_id, sessao_id) DO UPDATE SET
       sessao_num = EXCLUDED.sessao_num,
       versao_prompt = EXCLUDED.versao_prompt,
       versao_conceitualizacao = EXCLUDED.versao_conceitualizacao,
       nos = EXCLUDED.nos, arestas = EXCLUDED.arestas, criado_em = NOW()`,
    [opts.pacienteId, opts.sessaoId, `extracao-v3-${modo}`, null, JSON.stringify(nos), JSON.stringify(arestas)],
  )
  return { palavrasInseridas: nos.length, arestasInseridas: arestas.length }
}

/**
 * Deriva o agregado (palavras_chave/arestas_tema) a partir dos snapshots por
 * sessão. Recorrência = nº de sessões DISTINTAS em que o nó/aresta aparece
 * (contada do store, não inferida — §7.4). construto = o da sessão mais recente;
 * contextos = união de todas as sessões; relevancia = máxima. Arestas são
 * canonizadas (a<b) pro agregado; a direção fica preservada no store.
 */
async function derivarAgregado(pacienteId: string): Promise<void> {
  const { rows } = await db.query<{ sessao_id: string; sessao_num: number | null; nos: any; arestas: any }>(
    `SELECT sessao_id, sessao_num, nos, arestas FROM sessao_grafo WHERE paciente_id = $1 ORDER BY sessao_num ASC NULLS FIRST`,
    [pacienteId],
  )
  type AggNo = { cluster: string; sessoes: Set<string>; ultimaNum: number; ultimaSessao: string; construto: string | null; contextos: Set<string>; relevancia: number; fora: boolean }
  const nodeMap = new Map<string, AggNo>()
  const edgeMap = new Map<string, { a: string; b: string; tipo: string | null; sessoes: Set<string>; ultimaNum: number }>()
  for (const r of rows) {
    const num = r.sessao_num ?? 0
    for (const n of (Array.isArray(r.nos) ? r.nos : [])) {
      const nucleo = String(n?.nucleo ?? '').trim()
      if (!nucleo) continue
      let e = nodeMap.get(nucleo)
      if (!e) { e = { cluster: n?.cluster ?? 'cognitivo', sessoes: new Set(), ultimaNum: -1, ultimaSessao: r.sessao_id, construto: null, contextos: new Set(), relevancia: 0, fora: false }; nodeMap.set(nucleo, e) }
      e.sessoes.add(r.sessao_id)
      for (const c of (Array.isArray(n?.contextos) ? n.contextos : [])) { const s = String(c).trim(); if (s) e.contextos.add(s) }
      e.relevancia = Math.max(e.relevancia, Number(n?.relevancia) || 0)
      e.fora = e.fora || !!n?.fora
      if (num >= e.ultimaNum) { e.ultimaNum = num; if (n?.cluster) e.cluster = n.cluster; e.ultimaSessao = r.sessao_id; if (n?.construto) e.construto = String(n.construto) }
    }
    for (const a of (Array.isArray(r.arestas) ? r.arestas : [])) {
      const de = String(a?.de ?? '').trim(), para = String(a?.para ?? '').trim()
      if (!de || !para) continue
      const [x, y] = de < para ? [de, para] : [para, de]
      const key = JSON.stringify([x, y])
      let e = edgeMap.get(key)
      if (!e) { e = { a: x, b: y, tipo: a?.relacao ?? null, sessoes: new Set(), ultimaNum: -1 }; edgeMap.set(key, e) }
      e.sessoes.add(r.sessao_id)
      if (num >= e.ultimaNum) { e.ultimaNum = num; if (a?.relacao) e.tipo = a.relacao }
    }
  }
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM palavras_chave WHERE paciente_id = $1`, [pacienteId])
    await client.query(`DELETE FROM arestas_tema   WHERE paciente_id = $1`, [pacienteId])
    for (const [nucleo, e] of nodeMap) {
      await client.query(
        `INSERT INTO palavras_chave
           (paciente_id, palavra, cluster, frequencia, ultima_sessao_id, sessoes_ids, construto, contextos, relevancia, fora_conceitualizacao, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid, $6::jsonb, $7, $8::jsonb, $9, $10, NOW())`,
        [pacienteId, nucleo, e.cluster, e.sessoes.size, e.ultimaSessao, JSON.stringify([...e.sessoes]),
         e.construto, JSON.stringify([...e.contextos]), e.relevancia || null, e.fora],
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
 * Extrai temas da sessão (modo Clínico por padrão) e re-deriva o agregado.
 * Fail-closed: se a IA falhar, NÃO grava nada.
 */
export async function extrairTemasDaSessao(opts: {
  pacienteId: string
  sessaoId: string
  transcricao: string
  modo?: Modo
}): Promise<{ palavrasInseridas: number; arestasInseridas: number }> {
  let r: { palavrasInseridas: number; arestasInseridas: number } | null = null
  try {
    r = await extrairTemasComIA(opts, opts.modo ?? 'clinico')
  } catch (err) {
    console.warn(`[temas.grafo] extração lançou erro sessao=${opts.sessaoId}:`, err)
  }
  if (r) {
    try { await derivarAgregado(opts.pacienteId) } catch (err) {
      console.warn(`[temas.grafo] falha ao derivar agregado paciente=${opts.pacienteId}:`, err)
    }
    return r
  }
  console.warn(`[temas.grafo] sem resultado de IA sessao=${opts.sessaoId} — grafo não atualizado (fail-closed)`)
  return { palavrasInseridas: 0, arestasInseridas: 0 }
}

// ── Leitura agregada para o grafo ─────────────────────────────────────────
export type GrafoNode  = { palavra: string; cluster: Cluster; frequencia: number; sessoesIds: string[]; construto: string | null; contextos: string[]; relevancia: number | null; foraConceitualizacao: boolean }
export type GrafoEdge  = { a: string; b: string; weight: number; tipo?: string | null }
export type GrafoDados = { nodes: GrafoNode[]; edges: GrafoEdge[] }

export async function lerGrafo(pacienteId: string): Promise<GrafoDados> {
  const { rows } = await db.query<{ palavra: string; cluster: Cluster; frequencia: number; sessoes_ids: string[] | null; construto: string | null; contextos: string[] | null; relevancia: string | null; fora_conceitualizacao: boolean | null }>(
    // Recorrência contada do store; o nó entra a partir de 1 sessão. Cap em 40
    // pra legibilidade. construto/contextos vêm prontos (clique = leitura, §2).
    `SELECT palavra, cluster, frequencia, sessoes_ids, construto, contextos, relevancia, fora_conceitualizacao
       FROM palavras_chave
      WHERE paciente_id = $1 AND frequencia >= 1
      ORDER BY frequencia DESC, relevancia DESC NULLS LAST
      LIMIT 40`,
    [pacienteId],
  )
  const nodes: GrafoNode[] = rows.map(r => ({
    palavra: r.palavra,
    cluster: r.cluster,
    frequencia: r.frequencia,
    sessoesIds: Array.isArray(r.sessoes_ids) ? r.sessoes_ids : [],
    construto: r.construto ?? null,
    contextos: Array.isArray(r.contextos) ? r.contextos : [],
    relevancia: r.relevancia != null ? Number(r.relevancia) : null,
    foraConceitualizacao: !!r.fora_conceitualizacao,
  }))
  if (nodes.length === 0) return { nodes: [], edges: [] }
  const palavraSet = new Set(nodes.map(n => n.palavra))

  const { rows: edges } = await db.query<{ palavra_a: string; palavra_b: string; weight: number; tipo: string | null }>(
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
 * Recalcula tudo a partir das sessões assinadas (idempotente). Grava o snapshot
 * de cada sessão e deriva o agregado UMA vez no fim.
 */
export async function recalcularGrafo(pacienteId: string, modo: Modo = 'clinico'): Promise<{ sessoes: number; nodes: number }> {
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
    try { await extrairTemasComIA({ pacienteId, sessaoId: s.id, transcricao: tx }, modo) }
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
export async function recalcularGrafosTodos(modo: Modo = 'clinico'): Promise<{
  pacientes: number
  resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }>
}> {
  const { rows } = await db.query<{ paciente_id: string }>(
    `SELECT DISTINCT paciente_id FROM sessoes WHERE assinada = TRUE`,
  )
  const resultados: Array<{ pacienteId: string; sessoes: number; nodes: number }> = []
  for (const { paciente_id } of rows) {
    const r = await recalcularGrafo(paciente_id, modo)
    resultados.push({ pacienteId: paciente_id, ...r })
  }
  return { pacientes: rows.length, resultados }
}
