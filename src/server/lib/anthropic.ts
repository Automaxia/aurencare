import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { env, integrationStatus } from './env'
import { log } from './log'
import { validarTextoIA, sanitizarTextoIA } from './aiGuard'
import { CLINICAL_VOICE } from './clinicalVoice'

/**
 * Roteamento por tier de modelo (otimização de custo §IA):
 * - `fast`   (Haiku 4.5)  — chamadas mecânicas/ao vivo (tom, falante, obs-viva,
 *   contexto, marcar-turnos, insight, temas, saúde, voz WA, marcos). ~3× mais barato.
 * - `strong` (Sonnet 4.6) — APENAS onde vira prontuário ou avalia risco
 *   (resumo, risco, evolução longitudinal, chat clínico, narrativa de prontuário).
 *   Qualidade clínica + barreira anti-diagnóstico (CFP 09/2024) não pode escorregar.
 *
 * Default é `fast` — escolha consciente: o caller sensível PRECISA pedir `strong`.
 */
export type ModelTier = 'fast' | 'strong'
const MODEL_IDS: Record<ModelTier, string> = {
  fast:   'claude-haiku-4-5-20251001',
  strong: 'claude-sonnet-4-6',
}

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
  opts: { maxTokens?: number; scope?: string; model?: ModelTier } = {},
): Promise<string> {
  const c = getClient()
  if (!c) {
    log.warn(opts.scope ?? 'anthropic', 'sem ANTHROPIC_API_KEY — retornando placeholder')
    return '[Resposta de IA indisponível neste ambiente — configure ANTHROPIC_API_KEY em .env.local.]'
  }

  try {
    const res = await c.messages.create({
      model: MODEL_IDS[opts.model ?? 'fast'],
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

  return chat(SYS, [{ role: 'user', content: user }], { maxTokens: 600, scope: 'anthropic.resumo', model: 'strong' })
}
