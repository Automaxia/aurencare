/**
 * Formatadores compartilhados (client + server safe).
 */

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

export function formatBRL(centsOrFloat: number, asCents = false): string {
  const v = asCents ? centsOrFloat / 100 : centsOrFloat
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const TZ = 'America/Sao_Paulo'

// Brasil aboliu o horário de verão em 2019 — America/Sao_Paulo é UTC−03:00 o ano todo.
export const BR_UTC_OFFSET = '-03:00'

/**
 * Converte data (YYYY-MM-DD) + hora (HH:mm) DIGITADAS COMO HORÁRIO DE BRASÍLIA
 * (o fuso da clínica) num instante UTC em ISO — independente do fuso do navegador.
 *
 * Antes usávamos `new Date(\`${data}T${hora}\`)`, que interpreta a string no fuso
 * LOCAL do navegador: se a máquina não estivesse em BRT, a sessão era gravada com
 * o horário errado e a exibição (sempre forçada em BRT) mostrava deslocada.
 */
export function horarioBrasiliaParaISO(data: string, hora: string): string | null {
  if (!data || !hora) return null
  const dt = new Date(`${data}T${hora}:00${BR_UTC_OFFSET}`)
  if (Number.isNaN(+dt)) return null
  return dt.toISOString()
}

/** Data (YYYY-MM-DD) de um instante NO FUSO DE BRASÍLIA — não em UTC.
 *  Importa pra sessões à noite: 22h BRT = 01h UTC do dia seguinte; o `.toISOString()`
 *  cru cairia no dia errado. */
export function dataBrasiliaISO(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília — pra carimbar medições/marcos. */
export function hojeBrasiliaISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ })
}

export function formatTimeBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export function formatDateTimeBR(iso: string): string {
  return `${formatDateBR(iso)} às ${formatTimeBR(iso)}`
}

export function formatRelativeDays(iso: string | null): string | null {
  if (!iso) return null
  const dias = Math.floor((Date.now() - +new Date(iso)) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `${dias} dias atrás`
  if (dias < 30) return `${Math.floor(dias / 7)} sem atrás`
  return `${Math.floor(dias / 30)} mês${Math.floor(dias / 30) > 1 ? 'es' : ''} atrás`
}
