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

const STOPWORDS = new Set([
  'para','como','isso','aquilo','minha','meu','também','muito','mais','sobre','quando','porque',
  'então','mesmo','assim','depois','tinha','tenho','estar','estou','sendo','sempre','nunca',
  'aqui','agora','ainda','você','vocês','dele','dela','quero','quase','algum','alguma','sentir',
  'tive','consegui','conseguir','está','estão','este','esta','esse','essa','aquele','aquela',
  'porque','porquê','porqué','sobre','sobretudo','onde','quem','qual','quais','foram','foi',
  'sou','será','seja','seria','tinha','têm','tem','sem','com','por','dos','das','nos','nas',
  'pela','pelo','pelos','pelas','suas','seus','sua','seu','dele','dela',
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

function tokenize(texto: string): string[] {
  return texto.toLowerCase()
    .replace(/[.,;:!?()"…“”‘’\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/**
 * Extrai palavras significativas e atualiza palavras_chave + arestas_tema.
 */
export async function extrairTemasDaSessao(opts: {
  pacienteId: string
  sessaoId: string
  transcricao: string
}): Promise<{ palavrasInseridas: number; arestasInseridas: number }> {
  const tokens = tokenize(opts.transcricao)
  if (tokens.length === 0) return { palavrasInseridas: 0, arestasInseridas: 0 }

  // Frequência local na sessão.
  const local: Record<string, number> = {}
  for (const t of tokens) local[t] = (local[t] ?? 0) + 1

  // Mantém só palavras que aparecem >= 2x OU são seed conhecida
  const candidatas = Object.entries(local).filter(([w, c]) => c >= 2 || isSeed(w))
  if (candidatas.length === 0) return { palavrasInseridas: 0, arestasInseridas: 0 }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Upsert palavras (acumula frequência).
    for (const [palavra, freqLocal] of candidatas) {
      const cluster = inferirCluster(palavra)
      await client.query(
        `INSERT INTO palavras_chave (paciente_id, palavra, cluster, frequencia, ultima_sessao_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (paciente_id, palavra)
         DO UPDATE SET frequencia = palavras_chave.frequencia + EXCLUDED.frequencia,
                       cluster = EXCLUDED.cluster,
                       ultima_sessao_id = EXCLUDED.ultima_sessao_id,
                       updated_at = NOW()`,
        [opts.pacienteId, palavra, cluster, freqLocal, opts.sessaoId],
      )
    }

    // Arestas: para cada par de candidatas presentes nesta sessão, peso +1.
    const palavras = candidatas.map(c => c[0]).sort()
    let arestas = 0
    for (let i = 0; i < palavras.length; i++) {
      for (let j = i + 1; j < palavras.length; j++) {
        await client.query(
          `INSERT INTO arestas_tema (paciente_id, palavra_a, palavra_b, weight, updated_at)
           VALUES ($1, $2, $3, 1, NOW())
           ON CONFLICT (paciente_id, palavra_a, palavra_b)
           DO UPDATE SET weight = arestas_tema.weight + 1, updated_at = NOW()`,
          [opts.pacienteId, palavras[i], palavras[j]],
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
export type GrafoNode  = { palavra: string; cluster: Cluster; frequencia: number }
export type GrafoEdge  = { a: string; b: string; weight: number }
export type GrafoDados = { nodes: GrafoNode[]; edges: GrafoEdge[] }

export async function lerGrafo(pacienteId: string): Promise<GrafoDados> {
  const { rows: nodes } = await db.query<GrafoNode>(
    `SELECT palavra, cluster, frequencia
       FROM palavras_chave
      WHERE paciente_id = $1
      ORDER BY frequencia DESC
      LIMIT 60`,
    [pacienteId],
  )
  if (nodes.length === 0) return { nodes: [], edges: [] }
  const palavraSet = new Set(nodes.map(n => n.palavra))

  const { rows: edges } = await db.query<{ palavra_a: string; palavra_b: string; weight: number }>(
    `SELECT palavra_a, palavra_b, weight
       FROM arestas_tema
      WHERE paciente_id = $1 AND weight >= 1
      ORDER BY weight DESC
      LIMIT 240`,
    [pacienteId],
  )

  return {
    nodes,
    edges: edges
      .filter(e => palavraSet.has(e.palavra_a) && palavraSet.has(e.palavra_b))
      .map(e => ({ a: e.palavra_a, b: e.palavra_b, weight: e.weight })),
  }
}

/**
 * Recalcula tudo a partir das sessões assinadas (idempotente).
 */
export async function recalcularGrafo(pacienteId: string): Promise<{ sessoes: number; nodes: number }> {
  const { tryDecrypt } = await import('@/server/lib/crypto')

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

  const { rows: count } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM palavras_chave WHERE paciente_id = $1`, [pacienteId],
  )
  return { sessoes: sessoes.length, nodes: count[0].n }
}
