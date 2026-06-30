import 'server-only'

/**
 * Preços das APIs externas, pra estimar custo. Valores editáveis aqui — ajuste
 * conforme o contrato/console de cada provedor. USD; conversão p/ BRL no fim.
 *
 * ⚠️ Confirme os números no console de cada provedor antes de tomar decisão de
 * preço — aqui são os defaults públicos conhecidos.
 */

// Anthropic — USD por 1 milhão de tokens (entrada / saída), por modelo.
export const ANTHROPIC_PRECO: Record<string, { entradaPorM: number; saidaPorM: number }> = {
  'claude-haiku-4-5-20251001': { entradaPorM: 1.00, saidaPorM: 5.00 },
  'claude-sonnet-4-6':         { entradaPorM: 3.00, saidaPorM: 15.00 },
}

// OpenAI — USD por 1 milhão de tokens (entrada / saída), por modelo.
export const OPENAI_PRECO: Record<string, { entradaPorM: number; saidaPorM: number }> = {
  'gpt-4o':      { entradaPorM: 2.50, saidaPorM: 10.00 },
  'gpt-4o-mini': { entradaPorM: 0.15, saidaPorM: 0.60 },
}

// Fallback se o modelo não estiver mapeado (usa o mais caro, conservador).
const PRECO_FALLBACK = { entradaPorM: 3.00, saidaPorM: 15.00 }

export type ProviderLlm = 'openai' | 'anthropic'

// AssemblyAI Universal-Streaming — USD por hora de áudio (editável).
export const ASSEMBLY_USD_POR_HORA = 0.15

// Câmbio USD→BRL (editável; idealmente viraria env/cron no futuro).
export const USD_BRL = 5.40

/** Custo USD de uma chamada de LLM, escolhendo a tabela pelo provedor. */
export function custoLlmUsd(provider: ProviderLlm, modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const tabela = provider === 'openai' ? OPENAI_PRECO : ANTHROPIC_PRECO
  const p = tabela[modelo] ?? PRECO_FALLBACK
  return (tokensEntrada / 1_000_000) * p.entradaPorM + (tokensSaida / 1_000_000) * p.saidaPorM
}

/** Compat — mantido para callers antigos. */
export function custoAnthropicUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  return custoLlmUsd('anthropic', modelo, tokensEntrada, tokensSaida)
}

export function custoAssemblyUsd(segundos: number): number {
  return (segundos / 3600) * ASSEMBLY_USD_POR_HORA
}

export function usdParaBrl(usd: number): number {
  return usd * USD_BRL
}
