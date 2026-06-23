/**
 * Lógica de estado de objetivo — pura (sem db), usada no servidor (resumo) e no
 * client (cards). Determinística, observacional.
 */

export type EstadoObjetivo = 'avancando' | 'acompanhamento' | 'em_risco' | 'pausado' | 'concluido'

const DIAS = 86_400_000

/** Classifica o estado de um objetivo. "Em risco": ativo sem atualização há >21
 *  dias OU prazo vencido sem ter atingido a meta. */
export function estadoObjetivo(o: { status: string; progresso: number; updatedAt?: string | null; prazoEm: string | null }): EstadoObjetivo {
  if (o.status === 'concluido') return 'concluido'
  if (o.status === 'pausado') return 'pausado'
  const diasSemAtualizar = o.updatedAt ? Math.floor((Date.now() - +new Date(o.updatedAt)) / DIAS) : 0
  const prazoVencido = !!o.prazoEm && +new Date(o.prazoEm) < Date.now() && o.progresso < 100
  if (diasSemAtualizar > 21 || prazoVencido) return 'em_risco'
  if (o.progresso >= 50) return 'avancando'
  return 'acompanhamento'
}

export const ESTADO_META: Record<EstadoObjetivo, { label: string; emoji: string; cor: string; bg: string }> = {
  avancando:      { label: 'Avançando',         emoji: '🟢', cor: '#2a6456',     bg: 'rgba(90,158,138,.14)' },
  acompanhamento: { label: 'Em acompanhamento', emoji: '🟡', cor: '#7a5520',     bg: 'rgba(176,125,64,.14)' },
  em_risco:       { label: 'Em risco',          emoji: '🔴', cor: 'var(--rose)', bg: 'rgba(196,96,122,.12)' },
  pausado:        { label: 'Pausado',           emoji: '⏸',  cor: 'var(--muted)', bg: 'var(--surface)' },
  concluido:      { label: 'Concluído',         emoji: '✓',  cor: '#2a6456',     bg: 'rgba(90,158,138,.14)' },
}

/** Texto + cor do prazo, com estado (vencido / vencendo / normal). */
export function prazoEstado(prazoEm: string | null): { texto: string; cor: string } | null {
  if (!prazoEm) return null
  const dias = Math.ceil((+new Date(prazoEm) - Date.now()) / DIAS)
  const data = new Date(prazoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (dias < 0)  return { texto: `prazo vencido · ${data}`, cor: 'var(--rose)' }
  if (dias <= 7) return { texto: `prazo ${data} · vencendo`, cor: 'var(--amber)' }
  return { texto: `prazo ${data}`, cor: 'var(--faint)' }
}

export function haQuanto(iso: string): string {
  const dias = Math.floor((Date.now() - +new Date(iso)) / DIAS)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const m = Math.floor(dias / 30)
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
}
