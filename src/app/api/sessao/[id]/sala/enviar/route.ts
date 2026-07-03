import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { criarOuObterSala } from '@/server/services/salaVideo'
import { buscarSessao } from '@/server/services/sessoes'
import { enviarWADiag, WA_TEMPLATES } from '@/server/lib/evolution'
import { env } from '@/server/lib/env'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * Envia AGORA o link da sala de vídeo ao paciente por WhatsApp (o psicólogo já
 * está na chamada). Complementa o lembrete automático de 15min — necessário pra
 * chamadas ad-hoc, iniciadas na hora, que o cron não cobre.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao || sessao.psicologoId !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!sessao.pacienteTelefone) return NextResponse.json({ ok: false, error: 'sem_telefone' }, { status: 400 })

  const sala = await criarOuObterSala(params.id, 4)
  const linkSala = `${env.appUrl.replace(/\/$/, '')}/sala/${sala.token}`

  const r = await enviarWADiag(sessao.pacienteTelefone, WA_TEMPLATES.linkSalaAgora(linkSala))
  if (!r.ok) {
    log.err('sala.enviar', `falha ao enviar link WA sessao=${params.id}`, r.erro)
    return NextResponse.json({ ok: false, error: 'wa_falhou', detalhe: r.erro ?? null }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
