import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { transcreverChunk } from '@/server/lib/assemblyai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recebe um chunk de áudio (webm/opus, ~5s) e devolve o texto transcrito.
 * O cliente decide a quem atribuir o turno (psicóloga vs paciente).
 * §14: áudio NÃO é persistido.
 */
export async function POST(req: Request, _: { params: { id: string } }) {
  await requirePsicologo()

  const ct = req.headers.get('content-type') ?? ''
  let audio: Buffer

  if (ct.startsWith('application/octet-stream') || ct.startsWith('audio/')) {
    const ab = await req.arrayBuffer()
    audio = Buffer.from(ab)
  } else {
    // demo trigger: POST vazio → gera frase
    audio = Buffer.alloc(0)
  }

  const texto = await transcreverChunk(audio)
  return NextResponse.json({ texto, ts: new Date().toISOString() })
}
