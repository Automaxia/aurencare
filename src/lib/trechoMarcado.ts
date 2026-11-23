/**
 * Falas que compõem o destaque de uma marcação (indicadores.marcacoes[]).
 *
 * Padrão: a fala marcada + a anterior + a seguinte (contexto). Se o psicólogo
 * ajustou o destaque na revisão, `falas` guarda os índices escolhidos (posições
 * na transcrição, uma linha por turno). A fala marcada entra sempre.
 */
export const FALAS_MAX = 40

/** Saneia uma lista de índices de fala: inteiros, dentro da transcrição, sem repetição, ordenados. */
export function sanearFalas(falas: unknown, idx: number, total?: number): number[] | null {
  if (!Array.isArray(falas)) return null
  const set = new Set<number>([idx])
  for (const f of falas) {
    if (Number.isInteger(f) && f >= 0 && (total === undefined || f < total)) set.add(f)
  }
  return [...set].sort((a, b) => a - b).slice(0, FALAS_MAX)
}

export function falasPadrao(idx: number, total: number): number[] {
  return [idx - 1, idx, idx + 1].filter(i => i >= 0 && i < total)
}

export function falasDoTrecho(m: { idx: number; falas?: unknown }, total: number): number[] {
  return sanearFalas(m.falas, m.idx, total) ?? falasPadrao(m.idx, total)
}
