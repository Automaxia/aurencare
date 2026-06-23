import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Extração de palavras-chave e arestas (co-ocorrência por sessão).
 * §8: clusters emocional · relacional · situacional · cognitivo.
 *
 * Estratégia: heurística com listas-base por cluster. Palavras conhecidas
 * recebem cluster fixo; palavras genéricas não-stopwords vão para cluster
 * inferido pela co-ocorrência. Não usa IA para reduzir custo+latência.
 */

export type Cluster = 'emocional' | 'relacional' | 'situacional' | 'cognitivo'

/**
 * Stopwords expandida — fillers/pronomes/auxiliares/conjunções/marcadores
 * conversacionais comuns em PT-BR que NUNCA são tema clínico.
 */
const STOPWORDS = new Set([
  // pronomes + artigos compostos
  'para','como','isso','aquilo','minha','meu','também','muito','mais','sobre','quando','porque',
  'então','mesmo','assim','depois','tinha','tenho','estar','estou','sendo','sempre','nunca',
  'aqui','agora','ainda','você','vocês','dele','dela','quero','quase','algum','alguma',
  'tive','consegui','conseguir','está','estão','este','esta','esse','essa','aquele','aquela',
  'porque','porquê','porqué','sobre','sobretudo','onde','quem','qual','quais','foram','foi',
  'sou','será','seja','seria','têm','tem','sem','com','por','dos','das','nos','nas',
  'pela','pelo','pelos','pelas','suas','seus','sua','seu','aquilo','aquele','aqueles',
  // marcadores conversacionais (verbos genéricos de fala)
  'sabe','olha','veja','vamos','vamos','vamo','viu','sabe','sei','sabia','acho','achei',
  'penso','pensei','digo','disse','dizer','falo','falei','falar','vou','foi','indo','ido',
  'fico','ficou','ficar','ficaram','ficamos','fica','fiquei','ficando',
  'pode','podia','poder','consegue','consegui','conseguiu','conseguia','consigo',
  'preciso','precisei','queria','quis','quero','querer','tenta','tentar','tentei','tentou',
  'usar','usei','uso','usou','dou','dei','dar','dado','tive','tinha','têm',
  // adjetivos genéricos
  'pouco','pouca','poucos','muita','muitos','muitas','grande','grandes','pequeno','pequena',
  'certo','errado','difícil','fácil','novo','nova','velho','velha','bom','boa','ruim',
  'melhor','pior','perto','longe','dentro','fora','antes','depois','agora','hoje','ontem',
  'amanhã','manhã','tarde','noite','semana','semanas','mês','meses','ano','anos',
  'dia','dias','hora','horas','tempo','vez','vezes','momento','momentos',
  // preenchedores e exclamações
  'tudo','nada','algo','alguém','ninguém','todo','toda','todos','todas','nenhum','nenhuma',
  'cada','outro','outra','outros','outras','próprio','própria','mesma','mesmas','mesmos',
  'aquilo','aquele','aqueles','aquelas','tipo','sorte','jeito','coisa','coisas','meio',
  'modo','forma','formas','lado','tipo','tipos','parte','partes',
  // verbos auxiliares e cognitivos genéricos demais
  'verdade','realmente','exatamente','simplesmente','geralmente','provavelmente','talvez',
  'embora','enquanto','desde','até','até','contra','entre','sob','perante','salvo',
  'além','antes','após','dentro','fora','sob','sobre','depois','durante',
  // contractions e conectores
  'pra','pro','pras','pros','num','nuns','numa','dum','duma','no','na','do','da',
  'duas','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
  // marcadores acolhedores neutros
  'obrigada','obrigado','desculpa','desculpe','espera','espere','calma','tchau',
  // verbos de sentir/perceber muito genéricos
  'sentir','senti','sente','sentindo','sentia','percebe','percebi','percebeu','perceber',
  'vejo','vi','via','viu','olhar','olho','olhei','ouvir','ouvi','ouve','ouço',
  // outros enchedores
  'mente','cabeça','jeito','assim','desse','dessa','daquilo','daquela','disso','dessa',
  'mil','meses','passou','passar','passei','volta','voltar','voltei','volto',
  // resposta afirmativa/negativa
  'sim','não','talvez','claro','óbvio',
  // muito comuns mas pouco específicos
  'casa','vida','gente','pessoa','pessoas','homem','mulher','crianças','criança',
  'lugar','lugares','feito','fazer','faço','fiz','fazendo','fazendo','feita',
  // bordões, gírias e fillers conversacionais (#3) — nunca são tema clínico
  'né','sacou','saca','manja','manjou','mano','cara','véi','vei','tá','to','tô',
  'beleza','blz','nossa','putz','uai','ué','poxa','caramba','aff','enfim',
  'ahn','hum','hã','ahã','uhum','aham','eh','ah','oh','daí','aí','massa',
  'vish','eita','oxe','pô','po','cê','ce','tipo','tá','tipão','rolê','role',
])

const SEEDS: Record<Cluster, string[]> = {
  emocional: [
    'medo','ansiedade','ansioso','ansiosa','tristeza','triste','raiva','culpa','vergonha',
    'alegria','feliz','irritação','irritado','irritada','frustração','frustrado','frustrada',
    'angústia','solidão','vazio','calma','tranquilo','tranquila','euforia','pânico','tensão',
    'humor','emoção','emoções','sentimento','sentimentos','sofrimento','desconforto',
  ],
  relacional: [
    'mãe','pai','filho','filha','irmão','irmã','marido','esposa','namorado','namorada','parceiro',
    'parceira','companheiro','companheira','amigo','amiga','colega','chefe','equipe','família',
    'casamento','relacionamento','relação','vínculo','divórcio','separação','conflito','briga',
  ],
  situacional: [
    'trabalho','emprego','reunião','reuniões','apresentação','prova','escola','faculdade','viagem',
    'mudança','casa','dinheiro','rotina','agenda','prazo','projeto','férias','demissão','contratação',
    'crise','pandemia','consulta','médico','hospital','remédio','medicação','sono','exercício',
  ],
  cognitivo: [
    'pensamento','pensamentos','ideia','ideias','lembrança','memória','reflexão','decisão','escolha',
    'dúvida','dúvidas','crença','crenças','padrão','padrões','perspectiva','autocrítica','julgamento',
    'planejamento','foco','atenção','concentração','rumination','ruminação','perfeccionismo',
  ],
}

function inferirCluster(palavra: string): Cluster {
  for (const c of Object.keys(SEEDS) as Cluster[]) {
    if (SEEDS[c].includes(palavra)) return c
  }
  // Heurística leve para sufixos:
  if (/^(senti|emo|raiv|trist|med|alegr|ang|cult|vergonh|frust|ansi|calm)/.test(palavra)) return 'emocional'
  if (/^(mãe|pai|filh|irmã|maridã|esposa|namora|amig|coleg|chefe|famíl|relação)/.test(palavra)) return 'relacional'
  if (/^(trabalh|reuni|apresent|escola|facul|prov|viagem|casa|dinheir|rotin|prazo|projet|consult)/.test(palavra)) return 'situacional'
  return 'cognitivo'
}

/** Heurística: descarta verbos terminados em -ar/-er/-ir que NÃO sejam seed. */
function pareceVerboGenerico(w: string): boolean {
  if (isSeed(w)) return false
  // pegadores comuns de conjugação
  return /(?:ar|er|ir|ado|ada|ido|ida|ando|endo|indo|aria|eria|iria|amos|emos|imos|aram|eram|iram|asse|esse|isse|ou)$/.test(w)
}

function tokenize(texto: string): string[] {
  return texto.toLowerCase()
    .replace(/[.,;:!?()"…“”‘’\-]/g, ' ')
    .split(/\s+/)
    .filter(w => {
      if (w.length < 5) return false               // 4 era muito permissivo
      if (STOPWORDS.has(w)) return false
      if (/^\d+$/.test(w)) return false
      if (pareceVerboGenerico(w)) return false
      return true
    })
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

/**
 * Extrai palavras significativas e atualiza palavras_chave + arestas_tema.
 * Considera SOMENTE as falas do paciente (a análise é sobre o paciente).
 */

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

/** Extração via IA (MODE: GRAPH). Retorna null se falhar/parsear inválido → fallback. */
async function extrairTemasComIA(opts: { pacienteId: string; sessaoId: string; transcricao: string }): Promise<{ palavrasInseridas: number; arestasInseridas: number } | null> {
  const texto = somenteFalasDoPaciente(opts.transcricao).slice(0, 40_000)
  if (!texto.trim()) return { palavrasInseridas: 0, arestasInseridas: 0 }

  const { chat } = await import('@/server/lib/anthropic')
  const user = `<chunk>\n  <speaker>patient</speaker>\n  <text>\n${texto}\n  </text>\n</chunk>`
  let raw: string
  try { raw = await chat(GRAPH_PROMPT, [{ role: 'user', content: user }], { scope: 'temas.grafo', maxTokens: 1500, model: 'fast' }) }
  catch { return null }

  let parsed: any
  try { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null } catch { return null }
  if (!parsed || !Array.isArray(parsed.nodes)) return null

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
 * Extrai temas da sessão: IA (MODE: GRAPH) primeiro; se falhar/vazio, heurístico.
 */
export async function extrairTemasDaSessao(opts: {
  pacienteId: string
  sessaoId: string
  transcricao: string
}): Promise<{ palavrasInseridas: number; arestasInseridas: number }> {
  try {
    const r = await extrairTemasComIA(opts)
    if (r && (r.palavrasInseridas > 0 || r.arestasInseridas > 0)) return r
  } catch { /* fallback heurístico abaixo */ }
  return extrairTemasHeuristico(opts)
}

/** Fallback heurístico (sem IA): listas-base por cluster + co-ocorrência. */
async function extrairTemasHeuristico(opts: {
  pacienteId: string
  sessaoId: string
  transcricao: string
}): Promise<{ palavrasInseridas: number; arestasInseridas: number }> {
  const tokens = tokenize(somenteFalasDoPaciente(opts.transcricao))
  if (tokens.length === 0) return { palavrasInseridas: 0, arestasInseridas: 0 }

  // Frequência local na sessão.
  const local: Record<string, number> = {}
  for (const t of tokens) local[t] = (local[t] ?? 0) + 1

  // Mantém só palavras com sinal forte: freq >= 3 na sessão OU é seed conhecida.
  const candidatas = Object.entries(local).filter(([w, c]) => c >= 3 || isSeed(w))
  if (candidatas.length === 0) return { palavrasInseridas: 0, arestasInseridas: 0 }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Upsert palavras (acumula frequência + append sessao_id em sessoes_ids).
    for (const [palavra, freqLocal] of candidatas) {
      const cluster = inferirCluster(palavra)
      await client.query(
        `INSERT INTO palavras_chave (paciente_id, palavra, cluster, frequencia, ultima_sessao_id, sessoes_ids, updated_at)
         VALUES ($1, $2, $3, $4, $5::uuid, jsonb_build_array($6::text), NOW())
         ON CONFLICT (paciente_id, palavra)
         DO UPDATE SET
           frequencia = palavras_chave.frequencia + EXCLUDED.frequencia,
           cluster = EXCLUDED.cluster,
           ultima_sessao_id = EXCLUDED.ultima_sessao_id,
           sessoes_ids = CASE
             WHEN palavras_chave.sessoes_ids @> jsonb_build_array($6::text)
               THEN palavras_chave.sessoes_ids
             ELSE palavras_chave.sessoes_ids || jsonb_build_array($6::text)
           END,
           updated_at = NOW()`,
        [opts.pacienteId, palavra, cluster, freqLocal, opts.sessaoId, opts.sessaoId],
      )
    }

    // Arestas: pares apenas quando AO MENOS UMA das palavras é "forte"
    // (seed conhecida OU freq local >= 3). Reduz ruído de pares irrelevantes.
    const fortes = new Set(candidatas.filter(([w, c]) => c >= 3 || isSeed(w)).map(c => c[0]))
    const palavras = candidatas.map(c => c[0]).sort()
    let arestas = 0
    for (let i = 0; i < palavras.length; i++) {
      for (let j = i + 1; j < palavras.length; j++) {
        const a = palavras[i], b = palavras[j]
        if (!fortes.has(a) && !fortes.has(b)) continue
        await client.query(
          `INSERT INTO arestas_tema (paciente_id, palavra_a, palavra_b, weight, updated_at)
           VALUES ($1, $2, $3, 1, NOW())
           ON CONFLICT (paciente_id, palavra_a, palavra_b)
           DO UPDATE SET weight = arestas_tema.weight + 1, updated_at = NOW()`,
          [opts.pacienteId, a, b],
        )
        arestas++
      }
    }
    await client.query('COMMIT')
    return { palavrasInseridas: candidatas.length, arestasInseridas: arestas }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

function isSeed(palavra: string): boolean {
  return (Object.values(SEEDS) as string[][]).some(arr => arr.includes(palavra))
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
