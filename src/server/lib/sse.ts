import 'server-only'

/**
 * Bus SSE simples em memória — notifica UI quando pagamento confirma,
 * sessão começa, etc. Para produção, trocar por Redis pub/sub.
 */

export type SseEvent =
  | { type: 'sessao.confirmada';  sessaoId: string; pacienteId: string }
  | { type: 'sessao.iniciada';    sessaoId: string }
  | { type: 'sessao.encerrada';   sessaoId: string }
  | { type: 'pagamento.recebido'; sessaoId: string; valor: number }
  | { type: 'paciente.consentiu'; pacienteId: string }
  | { type: 'ping' }

type Subscriber = (e: SseEvent) => void

const globalAny = globalThis as unknown as { __aurenSubs?: Set<Subscriber> }
const subs: Set<Subscriber> = globalAny.__aurenSubs ?? new Set()
if (!globalAny.__aurenSubs) globalAny.__aurenSubs = subs

export function publish(e: SseEvent) {
  for (const s of subs) {
    try { s(e) } catch { /* swallow */ }
  }
}

export function subscribe(s: Subscriber): () => void {
  subs.add(s)
  return () => subs.delete(s)
}
