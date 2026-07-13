import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { env, integrationStatus } from './env'
import { log } from './log'
import { validarTextoIA, sanitizarTextoIA } from './aiGuard'
import { IA_SEM_CHAVE, IA_FALHA } from '@/lib/ia'

/**
 * Camada ÚNICA de acesso a LLM — roteamento por tier + fallback entre provedores.
 * Todo texto/classificação gerado por IA no produto passa por aqui (§IA).
 *
 * Provedores (a ordem de PROVIDER_ORDER é primário → fallback):
 *   1. OpenAI    — primário
 *   2. Anthropic — fallback (assume quando a OpenAI falha/timeouta)
 *
 * ⚠️ DADOS CLÍNICOS: com a OpenAI como primária, transcrição/nota do paciente
 * trafegam para a OpenAI na maioria das chamadas. Para manter LGPD/CFP e a
 * promessa "zero data training" exibida na UI, é OBRIGATÓRIO ter Zero Data
 * Retention (ZDR) + DPA com a OpenAI. Sem isso, mantenha 'anthropic' primeiro.
 *
 * Tiers de modelo (otimização de custo):
 *  - `fast`   — chamadas mecânicas/ao vivo (tom, falante, obs-viva, contexto,
 *    marcar-turnos, insight, temas, saúde, voz WA, marcos).
 *  - `strong` — APENAS onde vira prontuário ou avalia risco (resumo/laudo, risco,
 *    evolução longitudinal, chat clínico). Qualidade clínica + barreira
 *    anti-diagnóstico (CFP 09/2024) não pode escorregar.
 *
 * Default é `fast` — escolha consciente: o caller sensível PRECISA pedir `strong`.
 *
 * Prompt caching (opts.cache): só vale para o caminho Anthropic (cache_control
 * explícito; mínimo cacheável ~2048 tok no Sonnet / 4096 no Haiku). A OpenAI
 * cacheia prefixos automaticamente — a flag é ignorada no caminho dela.
 */

export type ModelTier = 'fast' | 'strong'
export type LlmProvider = 'openai' | 'anthropic'
export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Model IDs por provedor e tier. AJUSTE AQUI conforme o contrato/console de cada
 * provedor — confirme os IDs e preços vigentes antes de produção. Os preços por
 * modelo (para rastreio de custo) ficam em `precos.ts` com as MESMAS chaves.
 */
const MODELS: Record<LlmProvider, Record<ModelTier, string>> = {
  openai: {
    fast:   'gpt-4o-mini',
    strong: 'gpt-4o',
  },
  anthropic: {
    fast:   'claude-haiku-4-5-20251001',
    strong: 'claude-sonnet-4-6',
  },
}

/** Ordem de tentativa: primário primeiro, fallback depois. */
const PROVIDER_ORDER: LlmProvider[] = ['openai', 'anthropic']

/** Timeout por chamada: estoura rápido pra cair no fallback em vez de pendurar. */
const REQUEST_TIMEOUT_MS = 30_000

function providerConfigurado(p: LlmProvider): boolean {
  return p === 'openai' ? integrationStatus.openai : integrationStatus.anthropic
}

// ── Clients (lazy singletons) ───────────────────────────────────────────────
let openaiClient: OpenAI | null = null
function getOpenAi(): OpenAI | null {
  if (!integrationStatus.openai) return null
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env.openaiKey!, maxRetries: 1 })
  return openaiClient
}

let anthropicClient: Anthropic | null = null
function getAnthropic(): Anthropic | null {
  if (!integrationStatus.anthropic) return null
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.anthropicKey!, maxRetries: 1 })
  return anthropicClient
}

/** Detecta erro de saldo/billing da Anthropic (mensagem específica de crédito). */
function ehErroDeCreditoAnthropic(err: any): boolean {
  const msg = (err?.error?.error?.message ?? err?.message ?? '').toString().toLowerCase()
  return err?.status === 400 && (msg.includes('credit balance') || msg.includes('billing'))
}

type ChamadaResult = { texto: string; modelo: string; tokensEntrada: number; tokensSaida: number }

async function chamarOpenAi(
  modelo: string, system: string, messages: ChatMessage[], maxTokens: number,
): Promise<ChamadaResult> {
  const c = getOpenAi()
  if (!c) throw new Error('openai não configurado')
  // `max_completion_tokens` é o campo atual (compatível com gpt-4o/4.1 e o-series).
  // A OpenAI cacheia prefixos automaticamente — sem cache_control explícito.
  const res = await c.chat.completions.create(
    {
      model: modelo,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    },
    { timeout: REQUEST_TIMEOUT_MS },
  )
  return {
    texto: res.choices[0]?.message?.content ?? '',
    modelo,
    tokensEntrada: res.usage?.prompt_tokens ?? 0,
    tokensSaida: res.usage?.completion_tokens ?? 0,
  }
}

async function chamarAnthropic(
  modelo: string, systemPrompt: string, messages: ChatMessage[], maxTokens: number, cache: boolean, scope: string,
): Promise<ChamadaResult> {
  const c = getAnthropic()
  if (!c) throw new Error('anthropic não configurado')
  // Prompt caching (§10): só vale quando o prefixo estável (system) é grande.
  const system = cache
    ? [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : systemPrompt
  const res = await c.messages.create(
    { model: modelo, max_tokens: maxTokens, system, messages: messages.slice(-8) },
    { timeout: REQUEST_TIMEOUT_MS },
  )
  const u: any = res.usage
  const cacheRead = u?.cache_read_input_tokens ?? 0
  const cacheWrite = u?.cache_creation_input_tokens ?? 0
  if (cacheRead > 0) log.ok(scope, `cache hit: ${cacheRead} tokens lidos do cache`)
  return {
    texto: res.content.find(b => b.type === 'text')?.text ?? '',
    modelo,
    // tokens reais, incluindo os de cache (mesma aproximação do código anterior).
    tokensEntrada: (u?.input_tokens ?? 0) + cacheRead + cacheWrite,
    tokensSaida: u?.output_tokens ?? 0,
  }
}

function chamarProvider(
  provider: LlmProvider, tier: ModelTier, system: string, messages: ChatMessage[],
  maxTokens: number, cache: boolean, scope: string,
): Promise<ChamadaResult> {
  const modelo = MODELS[provider][tier]
  return provider === 'openai'
    ? chamarOpenAi(modelo, system, messages, maxTokens)
    : chamarAnthropic(modelo, system, messages, maxTokens, cache, scope)
}

/**
 * Gera texto via LLM. Tenta o provedor primário; em qualquer falha (erro de API,
 * timeout, saldo esgotado), cai para o próximo provedor configurado. A saída
 * SEMPRE passa por validarTextoIA → sanitizarTextoIA (barreira CFP 09/2024).
 */
export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: {
    /** Obrigatório: de quem é o gasto. Custo sem psicólogo é bloqueado (ver custos.ts). */
    psicologoId: string
    maxTokens?: number; scope?: string; model?: ModelTier; cache?: boolean
    sessaoId?: string | null; pacienteId?: string | null; escopoRecalculo?: number | null
  },
): Promise<string> {
  const tier = opts.model ?? 'fast'
  const maxTokens = opts.maxTokens ?? 1000
  const cache = opts.cache ?? false
  const scope = opts.scope ?? 'llm'

  const disponiveis = PROVIDER_ORDER.filter(providerConfigurado)
  if (disponiveis.length === 0) {
    log.warn(scope, 'nenhum provedor de IA configurado — retornando placeholder')
    return IA_SEM_CHAVE
  }

  let ultimoErro: unknown = null
  for (const provider of disponiveis) {
    try {
      const r = await chamarProvider(provider, tier, systemPrompt, messages, maxTokens, cache, scope)
      // Registra custo (tokens reais). Best-effort, não bloqueia a resposta.
      import('@/server/services/custos').then(m => m.registrarCustoLlm({
        provider, operacao: scope, modelo: r.modelo,
        tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida,
        psicologoId: opts.psicologoId, sessaoId: opts.sessaoId ?? null,
        pacienteId: opts.pacienteId ?? null, escopoRecalculo: opts.escopoRecalculo ?? null,
      })).catch(() => {})
      if (provider !== disponiveis[0]) {
        // Fallback silencioso pro Anthropic foi a origem do vazamento de custo (Haiku
        // custa ~8× o gpt-4o-mini no tier fast). Torna VISÍVEL: alerta alto quando um
        // `fast` é servido pelo Anthropic — sinaliza OpenAI indisponível/sem quota.
        if (provider === 'anthropic' && tier === 'fast') {
          log.err(scope, 'ALERTA CUSTO: chamada `fast` caiu no Anthropic (fallback) — gpt-4o-mini indisponível. Verifique OPENAI_API_KEY/quota.', undefined)
        } else {
          log.warn(scope, `respondido pelo fallback (${provider})`)
        }
      }
      return validarTextoIA(r.texto) ? r.texto : sanitizarTextoIA(r.texto)
    } catch (err) {
      ultimoErro = err
      if (provider === 'anthropic' && ehErroDeCreditoAnthropic(err)) {
        log.err(scope, 'SALDO DE CRÉDITO ESGOTADO na Anthropic — recarregue em console.anthropic.com/billing', undefined)
      } else {
        log.warn(scope, `provedor ${provider} falhou — tentando próximo`, err instanceof Error ? err.message : err)
      }
    }
  }

  log.err(scope, 'todos os provedores de IA falharam', ultimoErro)
  return IA_FALHA
}
