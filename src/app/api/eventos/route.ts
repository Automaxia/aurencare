import { subscribe } from '@/server/lib/sse'

/**
 * SSE — Server-Sent Events para o painel.
 * UI escuta GET /api/eventos e renderiza updates em tempo real (pagamento confirmado, etc).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (data: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'hello' })
      const heartbeat = setInterval(() => send({ type: 'ping' }), 25_000)
      const unsub = subscribe(e => send(e))

      const close = () => {
        clearInterval(heartbeat)
        unsub()
        try { controller.close() } catch { /* */ }
      }
      // node18+ — não temos AbortSignal aqui mas o handler termina ao fechar conexão.
      ;(controller as any)._auren_close = close
    },
    cancel() {
      // chamado quando o cliente desconecta
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
