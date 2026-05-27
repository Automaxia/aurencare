import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat, type ChatMessage } from '@/server/lib/anthropic'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'

const SYS_TEMAS = `Você analisa o mapa de correlações de palavras extraído de transcrições de sessões.
Responda sobre frequências, co-ocorrências e tendências.
NÃO interprete clinicamente. NÃO emita diagnósticos.
Máx. 140 palavras. Português brasileiro.`

const SYS_EVOLUCAO = `Você apoia a continuidade clínica de psicólogos, organizando observações de sessões.
Use APENAS linguagem de frequência e observação factual.
NUNCA: diagnóstico, interpretação clínica, "a paciente tem", "esquema de", "transferência".
USE: "frequência crescente", "co-ocorre em X sessões", "padrão observado", "tendência de redução".
Máx. 140 palavras. Português brasileiro.`

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const contexto = body?.contexto as 'temas' | 'evolucao' | undefined
  const pacienteId = body?.pacienteId as string | undefined
  const messages = (body?.messages ?? []) as ChatMessage[]
  const foco = body?.foco as string | undefined

  if (!contexto || !pacienteId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const { rows } = await db.query('SELECT nome FROM pacientes WHERE id = $1 AND psicologo_id = $2', [pacienteId, user.id])
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Grounding: prepara contexto factual conforme o tipo.
  let grounding = ''
  if (contexto === 'temas') {
    const { rows: ps } = await db.query(
      `SELECT palavra, cluster, frequencia FROM palavras_chave
        WHERE paciente_id = $1 ORDER BY frequencia DESC LIMIT 30`, [pacienteId])
    const { rows: es } = await db.query(
      `SELECT palavra_a, palavra_b, weight FROM arestas_tema
        WHERE paciente_id = $1 ORDER BY weight DESC LIMIT 40`, [pacienteId])
    grounding = `Dados disponíveis do paciente:\nPalavras (palavra · cluster · freq):\n${
      ps.map(p => `- ${p.palavra} · ${p.cluster} · ${p.frequencia}`).join('\n')
    }\n\nCo-ocorrências (palavra_a + palavra_b · peso):\n${
      es.map(e => `- ${e.palavra_a} + ${e.palavra_b} · ${e.weight}`).join('\n')
    }${foco ? `\n\nFoco da conversa: "${foco}"` : ''}`
  } else {
    const { rows: ss } = await db.query<{ data_hora: string; numero: number; resumo_ia: string | null }>(
      `SELECT data_hora, numero, resumo_ia FROM sessoes
        WHERE paciente_id = $1 AND assinada = TRUE
        ORDER BY data_hora ASC`, [pacienteId])
    grounding = `Sessões assinadas (resumos):\n${
      ss.map(s => {
        const txt = tryDecrypt(s.resumo_ia) ?? '(sem resumo)'
        return `Sessão #${s.numero} · ${new Date(s.data_hora).toLocaleDateString('pt-BR')}\n${txt}`
      }).join('\n\n')
    }`
  }

  const sys = (contexto === 'temas' ? SYS_TEMAS : SYS_EVOLUCAO) + `\n\n${grounding}`
  const text = await chat(sys, messages, { scope: `chat.${contexto}`, maxTokens: 600 })
  return NextResponse.json({ text })
}
