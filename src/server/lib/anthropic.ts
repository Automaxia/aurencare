import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { env, integrationStatus } from './env'
import { log } from './log'
import { validarTextoIA, sanitizarTextoIA } from './aiGuard'
import { CLINICAL_VOICE } from './clinicalVoice'

const MODEL = 'claude-sonnet-4-20250514'

let client: Anthropic | null = null
function getClient() {
  if (!integrationStatus.anthropic) return null
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey! })
  return client
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; scope?: string } = {},
): Promise<string> {
  const c = getClient()
  if (!c) {
    log.warn(opts.scope ?? 'anthropic', 'sem ANTHROPIC_API_KEY — retornando placeholder')
    return '[Resposta de IA indisponível neste ambiente — configure ANTHROPIC_API_KEY em .env.local.]'
  }

  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1000,
      system: systemPrompt,
      messages: messages.slice(-8),
    })
    const raw = res.content.find(b => b.type === 'text')?.text ?? ''
    return validarTextoIA(raw) ? raw : sanitizarTextoIA(raw)
  } catch (err) {
    log.err(opts.scope ?? 'anthropic', 'falha ao gerar', err)
    return '[Não foi possível gerar a resposta de IA agora.]'
  }
}

/**
 * Gera resumo de sessão para o Pós-sessão (§9 Evolução Registrada).
 */
export async function gerarResumoSessao(transcricao: string, contexto: { numero: number; pacienteNome: string }): Promise<string> {
  const SYS = `${CLINICAL_VOICE}

TAREFA: Rascunhar o resumo da sessão para revisão e assinatura da psicóloga.

ESTRUTURA do parágrafo (em ATÉ 140 palavras, parágrafo único, sem bullets):
1. Temas que apareceram nesta sessão (com frequência/duração relativa, se notável).
2. Mudança em relação ao histórico — o que persistiu, o que apareceu pela primeira vez, o que reduziu.
3. Tom geral observável (afeto referido, ritmo, oscilações), citando um trecho curto entre aspas se ajudar.
4. Tópicos em aberto deixados pelo(a) paciente.

NÃO use bullets, listas ou cabeçalhos. Um parágrafo corrido, denso, útil.
Cite o número da sessão atual quando comparar ("aumenta em relação à sessão #${contexto.numero - 1}").`

  const user = `Sessão #${contexto.numero} de ${contexto.pacienteNome}.
Transcrição (P = psicóloga, C = paciente):
"""
${transcricao.slice(0, 8_000)}
"""

Gere o rascunho do resumo desta sessão.`

  return chat(SYS, [{ role: 'user', content: user }], { maxTokens: 600, scope: 'anthropic.resumo' })
}
