import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { criarOuObterSala } from '@/server/services/salaVideo'
import { buscarSessao } from '@/server/services/sessoes'
import { env } from '@/server/lib/env'

/**
 * Psicóloga aciona a criação (idempotente) da sala de vídeo da sessão.
 * Retorna { token, urlPaciente, urlPsicologa, ativaAte }.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (sessao.psicologoId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sala = await criarOuObterSala(params.id, 4)
  return NextResponse.json({
    token: sala.token,
    urlPaciente: `${env.appUrl}/sala/${sala.token}`,
    urlPsicologa: `${env.appUrl}/sessao/${params.id}?modo=online`,
    ativaAte: sala.ativaAte,
  })
}
