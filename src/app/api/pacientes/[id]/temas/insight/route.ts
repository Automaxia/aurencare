import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerGrafo } from '@/server/services/temas'
import { chat } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS = `${CLINICAL_VOICE}

TAREFA: descrever os padrões mais salientes do mapa de temas do(a) paciente.
Você recebe palavras com seu cluster (emocional, relacional, situacional, cognitivo) e frequência, e as principais co-ocorrências.

Em ATÉ 90 PALAVRAS, em UM parágrafo (sem listas):
- Aponte 2-3 padrões: maior frequência, co-ocorrências que se repetem, possível variação longitudinal.
- Quando relevante, cruze clusters ('temas emocionais co-ocorrem com situacionais ligados a trabalho').
- Termine sugerindo uma direção de escuta para sessões futuras (sem prescrever ação).

Use vocabulário descritivo — frequência, co-ocorrência, padrão, tendência. Sem diagnóstico.`

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [params.id, user.id])
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Cache 1h via Redis (key invalidada quando recalcular)
  const cacheKey = `temas-insight:${params.id}`
  const r = await redis()
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) return NextResponse.json({ text: cached, cached: true })
  }

  const grafo = await lerGrafo(params.id)
  if (grafo.nodes.length === 0) {
    return NextResponse.json({ text: null })
  }

  const top = grafo.nodes.slice(0, 20).map(n => `${n.palavra} (${n.cluster}, ${n.frequencia}x)`).join('; ')
  const arestas = grafo.edges.slice(0, 15).map(e => `${e.a}+${e.b}=${e.weight}`).join('; ')
  const user_msg = `Palavras: ${top}\nCo-ocorrências: ${arestas}`

  const text = await chat(SYS, [{ role: 'user', content: user_msg }], { scope: 'insight.temas', maxTokens: 250 })

  if (r) await r.set(cacheKey, text, { EX: 3600 })
  return NextResponse.json({ text, cached: false })
}
