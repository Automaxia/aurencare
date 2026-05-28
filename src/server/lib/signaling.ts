import 'server-only'

/**
 * Signaling bus em memória — troca mensagens WebRTC (offer/answer/ICE) entre
 * peers da mesma sala. Cada peer assina SSE pra receber, e POSTa pra enviar.
 *
 * Adequado para 1:1 (sessão de terapia). Para escala, trocar por Redis pub/sub.
 */

export type SignalRole = 'psicologo' | 'paciente'

export type SignalMessage =
  | { type: 'hello';      from: SignalRole; ts: number }
  | { type: 'bye';        from: SignalRole; ts: number }
  | { type: 'offer';      from: SignalRole; sdp: string; ts: number }
  | { type: 'answer';     from: SignalRole; sdp: string; ts: number }
  | { type: 'candidate';  from: SignalRole; candidate: RTCIceCandidateInit; ts: number }
  | { type: 'ping';       ts: number }

type Subscriber = {
  role: SignalRole
  send: (m: SignalMessage) => void
}

const globalAny = globalThis as unknown as {
  __aurenSalas?: Map<string, Set<Subscriber>>
}
const salas: Map<string, Set<Subscriber>> = globalAny.__aurenSalas ?? new Map()
if (!globalAny.__aurenSalas) globalAny.__aurenSalas = salas

export function subscribe(token: string, sub: Subscriber): () => void {
  let s = salas.get(token)
  if (!s) { s = new Set(); salas.set(token, s) }
  s.add(sub)

  // notifica os outros que entrou
  const hello: SignalMessage = { type: 'hello', from: sub.role, ts: Date.now() }
  for (const o of s) if (o !== sub) try { o.send(hello) } catch { /* */ }

  return () => {
    s!.delete(sub)
    // notifica saída
    const bye: SignalMessage = { type: 'bye', from: sub.role, ts: Date.now() }
    for (const o of s!) try { o.send(bye) } catch { /* */ }
    if (s!.size === 0) salas.delete(token)
  }
}

/** Publica mensagem PRA outros peers da sala (não o emissor). */
export function publish(token: string, fromRole: SignalRole, message: SignalMessage): void {
  const s = salas.get(token)
  if (!s) return
  for (const sub of s) {
    if (sub.role === fromRole) continue
    try { sub.send(message) } catch { /* */ }
  }
}

export function listarOcupantes(token: string): SignalRole[] {
  const s = salas.get(token)
  if (!s) return []
  return Array.from(s).map(x => x.role)
}
