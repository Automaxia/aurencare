import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export type Marco = {
  data: string             // ISO
  numero: number           // # da sessão associada (ou 0 se transversal)
  titulo: string
  descricao: string
  tipo: 'avanco' | 'insight' | 'mudanca' | 'inicio' | 'observacao'
}

const SYS = `Você analisa os resumos das sessões de um paciente e extrai MARCOS DO PROCESSO terapêutico.
Marcos são momentos relevantes observados — primeira menção de um tema, primeira tentativa concreta de mudança,
reconhecimento de padrão, abertura emocional, redução perceptível de sintoma, etc.

Retorne EXCLUSIVAMENTE JSON, sem prosa, sem markdown:
{
  "marcos": [
    { "numero": 5, "tipo": "insight|avanco|mudanca|inicio|observacao", "titulo": "...", "descricao": "..." }
  ]
}

Regras:
- 3 a 6 marcos, ordenados cronologicamente.
- "tipo": "inicio" só na primeira sessão; "insight" reconhecimento; "avanco" tentativa de mudança; "mudanca" mudança observada;
   "observacao" para padrão registrado sem ação clara.
- "titulo" curto (até 50 chars). "descricao" 1 frase com referência factual ("a partir da sessão #N", "co-ocorrência crescente").
- NÃO emita diagnóstico. NÃO interprete clinicamente. Use linguagem observacional.
- Se houver menos de 2 sessões assinadas, retorne {"marcos": []}.`

export async function lerMarcos(pacienteId: string): Promise<Marco[]> {
  const cacheKey = `marcos:${pacienteId}`
  const r = await redis()
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) {
      try { return JSON.parse(cached) } catch { /* */ }
    }
  }

  const { rows } = await db.query<{ numero: number; data_hora: string; resumo_ia: string | null }>(
    `SELECT numero, data_hora, resumo_ia
       FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora ASC`,
    [pacienteId],
  )
  if (rows.length < 2) return []

  const resumos = rows
    .map(r => ({ numero: r.numero, data: r.data_hora, texto: tryDecrypt(r.resumo_ia) ?? '' }))
    .filter(r => r.texto.length > 10)
  if (resumos.length === 0) return []

  const userMsg = resumos
    .map(r => `Sessão #${r.numero} (${new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}):\n${r.texto}`)
    .join('\n\n')

  const raw = await chat(SYS, [{ role: 'user', content: userMsg }], { scope: 'marcos', maxTokens: 700 })

  let marcos: Marco[] = []
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const json = m ? JSON.parse(m[0]) : {}
    const arr = Array.isArray(json.marcos) ? json.marcos : []
    marcos = arr.slice(0, 6).map((it: any) => {
      const numero = Number(it.numero) || 0
      const fonte = resumos.find(r => r.numero === numero) ?? resumos[0]
      return {
        data: fonte.data,
        numero,
        titulo: String(it.titulo ?? '').slice(0, 200),
        descricao: String(it.descricao ?? '').slice(0, 300),
        tipo: (['avanco','insight','mudanca','inicio','observacao'].includes(it.tipo) ? it.tipo : 'observacao') as Marco['tipo'],
      }
    })
  } catch { /* mantém vazio */ }

  if (r && marcos.length > 0) await r.set(cacheKey, JSON.stringify(marcos), { EX: 86400 })
  return marcos
}
