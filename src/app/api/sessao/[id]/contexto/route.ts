import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao } from '@/server/services/sessoes'
import { ultimaSessaoAssinada, ultimasSessoesAssinadas, lerCondicoesPaciente } from '@/server/services/contexto'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS_TOPICOS = `Você recebe 1-3 resumos de sessões anteriores e extrai 3-5 tópicos clínicos que ficaram em aberto ou pendentes de exploração futura.
Tópicos devem ser SUBSTANTIVOS curtos (até 8 palavras cada), em frases nominais ou verbais curtas.
NÃO interprete. Use linguagem observacional.
Retorne EXCLUSIVAMENTE JSON: {"topicos":["...","..."]}`

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (sessao.psicologoId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [ultima, condicoes] = await Promise.all([
    ultimaSessaoAssinada(sessao.pacienteId, sessao.id),
    lerCondicoesPaciente(sessao.pacienteId),
  ])

  // Tópicos em aberto via IA (cache 24h)
  const cacheKey = `topicos:${sessao.pacienteId}`
  const r = await redis()
  let topicos: string[] = []
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) { try { topicos = JSON.parse(cached) } catch { /* */ } }
  }

  if (topicos.length === 0) {
    const ultimas = await ultimasSessoesAssinadas(sessao.pacienteId, 3)
    if (ultimas.length > 0) {
      const userMsg = ultimas
        .map(u => `Sessão #${u.numero} (${new Date(u.dataHora).toLocaleDateString('pt-BR')}):\n${u.resumo}`)
        .join('\n\n')
      const raw = await chat(SYS_TOPICOS, [{ role: 'user', content: userMsg }], { scope: 'contexto.topicos', maxTokens: 300 })
      try {
        const m = raw.match(/\{[\s\S]*\}/)
        const json = m ? JSON.parse(m[0]) : {}
        if (Array.isArray(json.topicos)) topicos = json.topicos.slice(0, 5).map((t: any) => String(t).slice(0, 80))
      } catch { /* */ }
      if (r && topicos.length > 0) await r.set(cacheKey, JSON.stringify(topicos), { EX: 86400 })
    }
  }

  return NextResponse.json({ ultima, condicoes, topicos })
}
