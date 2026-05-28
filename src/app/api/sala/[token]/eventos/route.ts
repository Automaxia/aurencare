import { subscribe, type SignalRole } from '@/server/lib/signaling'
import { buscarSalaPorToken } from '@/server/services/salaVideo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * SSE endpoint pro peer escutar mensagens de signaling.
 * Query: ?role=psicologo | paciente
 *
 * Não exige login (paciente entra por link público). Token da sala é o gate.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const url = new URL(req.url)
  const role = (url.searchParams.get('role') ?? 'paciente') as SignalRole
  if (role !== 'psicologo' && role !== 'paciente') {
    return new Response('bad role', { status: 400 })
  }

  const sala = await buscarSalaPorToken(params.token)
  if (!sala) return new Response('sala não encontrada', { status: 404 })
  if (sala.encerradaEm || new Date(sala.ativaAte) < new Date()) {
    return new Response('sala encerrada', { status: 410 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (data: any) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)) }
        catch { /* controller fechado */ }
      }

      send({ type: 'hello', from: role, ts: Date.now() })  // confirma entrada

      const unsub = subscribe(params.token, { role, send })
      const heartbeat = setInterval(() => send({ type: 'ping', ts: Date.now() }), 25_000)

      ;(controller as any)._auren_close = () => {
        clearInterval(heartbeat)
        unsub()
      }
    },
    cancel() {
      // chamado quando cliente desconecta
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
