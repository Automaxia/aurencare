import 'server-only'

/**
 * Bus SSE simples em memória — notifica UI quando pagamento confirma,
 * sessão começa, etc. Para produção, trocar por Redis pub/sub.
 */

/**
 * Todo evento leva o `psicologoId` dono: a rota /api/eventos só entrega à
 * própria psicóloga. Antes o bus mandava tudo para todos os conectados —
 * ids e valores das sessões de outras contas chegavam a qualquer logado.
 */
export type SseEvent =
  | { type: 'sessao.confirmada';  psicologoId: string; sessaoId: string; pacienteId: string }
  | { type: 'sessao.iniciada';    psicologoId: string; sessaoId: string }
  | { type: 'sessao.encerrada';   psicologoId: string; sessaoId: string }
  | { type: 'pagamento.recebido'; psicologoId: string; sessaoId: string; valor: number }
  | { type: 'paciente.consentiu'; psicologoId: string; pacienteId: string }
  | { type: 'ping' }

type Subscriber = (e: SseEvent) => void

const globalAny = globalThis as unknown as { __audereSubs?: Set<Subscriber> }
const subs: Set<Subscriber> = globalAny.__audereSubs ?? new Set()
if (!globalAny.__audereSubs) globalAny.__audereSubs = subs

export function publish(e: SseEvent) {
  for (const s of subs) {
    try { s(e) } catch { /* swallow */ }
  }
}

export function subscribe(s: Subscriber): () => void {
  subs.add(s)
  return () => subs.delete(s)
}
