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

const TZ = 'America/Sao_Paulo'

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
