import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao } from '@/server/services/sessoes'
import { ultimasSessoesAssinadas } from '@/server/services/contexto'
import { chat, iaIndisponivel } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

/**
 * Resumo curto/médio da sessão ANTERIOR + tarefas/plano de ação combinados nela.
 * Extraído do laudo assinado da última sessão (IA · Haiku), com cache 24h — o
 * laudo é imutável depois de assinado. Só extrai tarefas EXPLÍCITAS (fail-closed).
 */
const SYS = `Você recebe o laudo de UMA sessão de psicoterapia. Produza:
- "resumo": 2 a 4 frases curtas, em linguagem observacional, do que foi trabalhado. NÃO diagnostique nem interprete além do laudo.
- "tarefas": as tarefas / plano de ação combinados COM o paciente para depois da sessão (exercícios, práticas, registros, experimentos comportamentais). Extraia APENAS o que está EXPLÍCITO no laudo. Se nada foi combinado, retorne [].
Português brasileiro. Responda EXCLUSIVAMENTE com JSON: {"resumo":"...","tarefas":["...","..."]}`

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao || sessao.psicologoId !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [prev] = await ultimasSessoesAssinadas(sessao.pacienteId, 1)
  if (!prev || !prev.resumo.trim()) return NextResponse.json({ disponivel: false })

  const cacheKey = `anterior:${sessao.pacienteId}:${prev.numero}`
  const r = await redis()
  if (r) {
    const c = await r.get(cacheKey)
    if (c) { try { return NextResponse.json(JSON.parse(c)) } catch { /* */ } }
  }

  let resumo = '', tarefas: string[] = [], iaOk = true
  try {
    const raw = await chat(SYS, [{ role: 'user', content: `Sessão #${prev.numero}:\n${prev.resumo.slice(0, 8000)}` }], { scope: 'sessao.anterior', maxTokens: 500, psicologoId: user.id, sessaoId: sessao.id, pacienteId: sessao.pacienteId })
    if (iaIndisponivel(raw)) iaOk = false
    else {
      const m = raw.match(/\{[\s\S]*\}/)
      const j = m ? JSON.parse(m[0]) : {}
      resumo = typeof j.resumo === 'string' ? j.resumo.trim().slice(0, 900) : ''
      tarefas = Array.isArray(j.tarefas) ? j.tarefas.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8) : []
    }
  } catch { iaOk = false }

  // Fallback: IA fora → mostra o começo do laudo cru (sem inventar tarefas).
  if (!resumo) resumo = prev.resumo.slice(0, 600).trim()

  const payload = { disponivel: true, numero: prev.numero, dataHora: prev.dataHora, resumo, tarefas }
  if (r && iaOk) await r.set(cacheKey, JSON.stringify(payload), { EX: 86400 })
  return NextResponse.json(payload)
}
