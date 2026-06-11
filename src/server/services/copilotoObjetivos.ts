import 'server-only'
import { db } from '@/server/db/pool'
import { chat } from '@/server/lib/anthropic'
import { lerGrafo } from './temas'

/**
 * Copiloto de objetivos SMART — a Audere propõe metas RASCUNHO a partir dos TEMAS
 * recorrentes observados. IA estruturada (JSON), ancorada no grafo do paciente:
 * não inventa do nada e não repete objetivos já criados. Linguagem observacional,
 * nunca diagnóstica (CFP 09/2024). O psicólogo edita tudo no wizard antes de salvar.
 */

export type SmartSugestao = {
  titulo: string
  relevancia: string
  metricaTipo: 'absoluta' | 'gas'
  unidade: string | null
  baseline: number | null
  alvo: number | null
  prazoSemanas: number | null
  tema: string | null
}

const SYS = `Você é copiloto de um(a) psicólogo(a) criando OBJETIVOS TERAPÊUTICOS no formato SMART,
a partir dos TEMAS recorrentes observados nas sessões. Proponha de 2 a 3 objetivos como RASCUNHO editável.

Responda EXCLUSIVAMENTE com JSON, sem prosa nem markdown:
{
  "sugestoes": [
    {
      "titulo": "frase específica e observável, começando por verbo (ex: 'Reduzir episódios de ansiedade no trabalho')",
      "relevancia": "1 frase: por que faz sentido clinicamente, em linguagem observacional",
      "metricaTipo": "absoluta" | "gas",
      "unidade": "unidade contável (ex: 'episódios/semana', 'min de respiração/dia') — só em absoluta; null em gas",
      "baseline": número de partida plausível (só absoluta; null em gas),
      "alvo": número da meta (só absoluta; null em gas),
      "prazoSemanas": número de semanas sugerido (ex: 8) ou null,
      "tema": "tema de origem"
    }
  ]
}

Regras:
- "absoluta" quando o tema permite contagem objetiva (frequência, tempo, quantidade); "gas" quando é subjetivo (culpa, autoestima, relação com alguém).
- baseline e alvo coerentes com a direção (reduzir → alvo < baseline; fortalecer → alvo > baseline). São estimativas de RASCUNHO.
- "titulo" até 60 caracteres; "relevancia" até 140.
- NUNCA emita diagnóstico nem interprete clinicamente. Use linguagem observacional (frequência, padrão, co-ocorrência).
- NÃO repita objetivos já criados. Se não houver temas suficientes, retorne {"sugestoes": []}.`

export async function copilotoObjetivos(pacienteId: string): Promise<SmartSugestao[]> {
  const [grafo, objs] = await Promise.all([
    lerGrafo(pacienteId),
    db.query<{ titulo: string }>(`SELECT titulo FROM objetivos WHERE paciente_id = $1`, [pacienteId]),
  ])
  if (grafo.nodes.length === 0) return []   // sem temas → sem grounding; o copiloto não inventa

  const temas = grafo.nodes.slice(0, 10)
    .map(n => `${n.palavra} (${n.cluster}, ${n.frequencia}x)`).join(', ')
  const cooc = grafo.edges.slice(0, 6).map(e => `${e.a}+${e.b}`).join(', ') || '(nenhuma)'
  const existentes = objs.rows.map(r => r.titulo).join('; ') || '(nenhum)'

  const userMsg = `Temas recorrentes observados: ${temas}.
Co-ocorrências: ${cooc}.
Objetivos já criados (não repita): ${existentes}.`

  const raw = await chat(SYS, [{ role: 'user', content: userMsg }], {
    scope: 'objetivos.copiloto', maxTokens: 900, model: 'strong',
  })

  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const json = m ? JSON.parse(m[0]) : {}
    const arr = Array.isArray(json.sugestoes) ? json.sugestoes : []
    return arr.slice(0, 3).map((it: any): SmartSugestao => {
      const tipo: 'absoluta' | 'gas' = it.metricaTipo === 'gas' ? 'gas' : 'absoluta'
      const num = (v: any) => (v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
      return {
        titulo: String(it.titulo ?? '').slice(0, 80).trim(),
        relevancia: String(it.relevancia ?? '').slice(0, 200).trim(),
        metricaTipo: tipo,
        unidade: tipo === 'absoluta' ? (it.unidade ? String(it.unidade).slice(0, 80) : null) : null,
        baseline: tipo === 'absoluta' ? num(it.baseline) : null,
        alvo: tipo === 'absoluta' ? num(it.alvo) : null,
        prazoSemanas: num(it.prazoSemanas),
        tema: it.tema ? String(it.tema).slice(0, 60) : null,
      }
    }).filter((s: SmartSugestao) => s.titulo.length >= 4)
  } catch {
    return []
  }
}
