import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat, type ChatMessage } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'

const SYS_TEMAS = `${CLINICAL_VOICE}

CONTEXTO: você está conversando com a psicóloga sobre o mapa de temas (palavras com cluster, frequência e co-ocorrências) extraído das transcrições.
Responda sobre frequências, co-ocorrências, tendências longitudinais, cruzamentos entre clusters.
Se ela pedir algo que beire diagnóstico, devolva a pergunta em chave observacional ('o que se observa no mapa é…').
Máx. 140 palavras por resposta. UM parágrafo.`

const SYS_EVOLUCAO = `${CLINICAL_VOICE}

CONTEXTO: você está conversando com a psicóloga sobre a evolução longitudinal do(a) paciente — resumos das sessões assinadas.
Compare sessões pelo número, aponte continuidades e mudanças, frequências, espaçamento.
Quando ela perguntar 'o que está acontecendo', responda em chave de OBSERVAÇÃO da fala, não de interpretação clínica.
Máx. 140 palavras por resposta. UM parágrafo, sem listas numeradas.`

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
  const text = await chat(sys, messages, { scope: `chat.${contexto}`, maxTokens: 600, model: 'strong' })
  return NextResponse.json({ text })
}
