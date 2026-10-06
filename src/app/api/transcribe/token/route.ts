import { NextResponse } from 'next/server'
import { env, integrationStatus } from '@/server/lib/env'
import { log } from '@/server/lib/log'
import { requirePsicologo } from '@/server/lib/auth'
import { bloqueioCotaIa } from '@/server/lib/cotaIa'
import { obterAssinatura } from '@/server/services/assinatura'
import { BETA_LIBERADO } from '@/server/lib/planos'

/**
 * GET /api/transcribe/token
 * Gera um token efêmero (10 min) pra cliente conectar direto na
 * AssemblyAI Universal-Streaming v3 via WebSocket sem expor a master key.
 *
 * Auth: protegido pelo middleware (sessão NextAuth obrigatória).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  // Cota: o token abre a transcrição (o custo mais caro da sessão-IA), então
  // passa pelo mesmo controle das demais rotas de IA. Sem `?sessao=` (aba antiga
  // aberta durante o deploy) checa só se o plano ainda tem saldo no mês.
  const user = await requirePsicologo()
  const sessaoId = new URL(req.url).searchParams.get('sessao')
  if (sessaoId) {
    const bloqueio = await bloqueioCotaIa(user.id, sessaoId)
    if (bloqueio) return bloqueio
  } else if (!BETA_LIBERADO) {
    const info = await obterAssinatura(user.id)
    if (info.usadas >= info.cap) return NextResponse.json({ ok: false, error: 'limite_plano' }, { status: 403 })
  }

  if (!integrationStatus.assembly) {
    return NextResponse.json({ demo: true, token: null }, { status: 200 })
  }

  try {
    const res = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
      headers: { Authorization: env.assemblyKey! },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      log.err('assemblyai.token', `${res.status} ${body}`)
      return NextResponse.json({ error: 'token indisponível' }, { status: 502 })
    }
    const json = await res.json() as { token: string; expires_in_seconds: number }
    return NextResponse.json({
      token: json.token,
      expiresIn: json.expires_in_seconds,
    })
  } catch (err) {
    log.err('assemblyai.token', 'fetch falhou', err)
    return NextResponse.json({ error: 'token indisponível' }, { status: 502 })
  }
}
