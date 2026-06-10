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
// Fallback se o modelo não estiver mapeado (usa o mais caro, conservador).
const ANTHROPIC_FALLBACK = { entradaPorM: 3.00, saidaPorM: 15.00 }

// AssemblyAI Universal-Streaming — USD por hora de áudio (editável).
export const ASSEMBLY_USD_POR_HORA = 0.15

// Câmbio USD→BRL (editável; idealmente viraria env/cron no futuro).
export const USD_BRL = 5.40

export function custoAnthropicUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const p = ANTHROPIC_PRECO[modelo] ?? ANTHROPIC_FALLBACK
  return (tokensEntrada / 1_000_000) * p.entradaPorM + (tokensSaida / 1_000_000) * p.saidaPorM
}

export function custoAssemblyUsd(segundos: number): number {
  return (segundos / 3600) * ASSEMBLY_USD_POR_HORA
}

export function usdParaBrl(usd: number): number {
  return usd * USD_BRL
}
