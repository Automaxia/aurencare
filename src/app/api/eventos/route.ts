import { subscribe } from '@/server/lib/sse'

/**
 * SSE — Server-Sent Events para o painel.
 * UI escuta GET /api/eventos e renderiza updates em tempo real (pagamento confirmado, etc).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  let closed = false
  let cleanup = () => {}

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      // enqueue após o fecho lança ERR_INVALID_STATE — guarda e auto-limpa.
      const send = (data: any) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          cleanup()
        }
      }

      const heartbeat = setInterval(() => send({ type: 'ping' }), 25_000)
      const unsub = subscribe(e => send(e))

      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsub()
        try { controller.close() } catch { /* já fechado */ }
      }

      // Desconexão do cliente: aborta o fetch -> limpa heartbeat + subscription.
      req.signal.addEventListener('abort', cleanup)

      send({ type: 'hello' })
    },
    cancel() {
      // cliente desconectou (ou stream cancelado): para o heartbeat e desinscreve.
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection:      'keep-alive',
    },
  })
}
