import 'server-only'
import { lerGrafo } from './temas'

/**
 * Sugestões de objetivo a partir dos TEMAS observados (estado vazio inteligente,
 * Fase 4). Determinístico — só transforma tema em um título de partida. NÃO cria
 * objetivo; é apoio à reflexão. O psicólogo edita tudo no wizard.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Verbo de partida por natureza do tema. Curado pra não sugerir absurdo
// ("Reduzir alegria"); o que não casa vira o neutro "Trabalhar".
const REDUZIR = new Set([
  'ansiedade', 'ansioso', 'ansiosa', 'medo', 'raiva', 'culpa', 'vergonha', 'tristeza', 'triste',
  'solidao', 'vazio', 'panico', 'tensao', 'tenso', 'frustracao', 'irritacao', 'insonia',
  'estresse', 'sofrimento', 'ruminacao', 'cobranca', 'autocritica', 'perfeccionismo',
])
const FORTALECER = new Set([
  'autoestima', 'autoconfianca', 'assertividade', 'foco', 'autonomia', 'autocuidado', 'limites',
])
const MELHORAR = new Set([
  'sono', 'rotina', 'relacionamento', 'comunicacao', 'vinculo',
])

function verboPara(palavra: string): string {
  const p = norm(palavra)
  if (REDUZIR.has(p))    return 'Reduzir'
  if (FORTALECER.has(p)) return 'Fortalecer'
  if (MELHORAR.has(p))   return 'Melhorar'
  return 'Trabalhar'
}

export async function sugestoesObjetivos(pacienteId: string): Promise<{ titulo: string; tema: string }[]> {
  const grafo = await lerGrafo(pacienteId)
  return grafo.nodes.slice(0, 5).map(n => ({
    titulo: `${verboPara(n.palavra)} ${n.palavra}`,
    tema: n.palavra,
  }))
}
