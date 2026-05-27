import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerGrafo } from '@/server/services/temas'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS = `Você analisa um mapa de correlações de palavras (clusters: emocional, relacional, situacional, cognitivo) extraído de transcrições de sessões.
Em ATÉ 90 PALAVRAS, descreva os 2-3 padrões mais salientes observados — frequência, co-ocorrências, possível tendência longitudinal.
NÃO interprete clinicamente. NÃO emita diagnóstico. Use linguagem de observação ("observa-se", "co-ocorre em X sessões", "frequência crescente").
Português brasileiro. Sem listas numeradas; um único parágrafo conciso.`

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
