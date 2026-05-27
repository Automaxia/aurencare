import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { env, integrationStatus } from './env'
import { log } from './log'
import { validarTextoIA, sanitizarTextoIA } from './aiGuard'

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
  const SYS = `Você apoia a continuidade clínica de psicólogos, organizando observações de sessões.
Use APENAS linguagem de frequência e observação factual.
NUNCA: diagnóstico, interpretação clínica, "a paciente tem", "esquema de", "transferência".
USE: "frequência crescente", "co-ocorre em X sessões", "padrão observado", "tendência de redução".
Máx. 140 palavras. Português brasileiro.`

  const user = `Sessão #${contexto.numero} de ${contexto.pacienteNome}.
Transcrição:
"""
${transcricao.slice(0, 8_000)}
"""

Gere um rascunho de resumo clínico para revisão da psicóloga.`

  return chat(SYS, [{ role: 'user', content: user }], { maxTokens: 600, scope: 'anthropic.resumo' })
}
