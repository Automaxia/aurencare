import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { lerWebhookEvolution, configurarWebhookEvolution, webhookUrlEvolution } from '@/server/lib/evolution'

export const dynamic = 'force-dynamic'

/**
 * Admin (logado): diagnostica/configura o webhook da instância Evolution.
 * - GET            → mostra o webhook atual + a URL esperada
 * - GET ?aplicar=1 → aponta o webhook pro app (MESSAGES_UPSERT etc.)
 * Sem MESSAGES_UPSERT apontando pra cá, as respostas do paciente (PIX/CREDITO/…)
 * não chegam e o fluxo de pagamento trava.
 */
export async function GET(req: Request) {
  await requirePsicologo()
  const aplicar = new URL(req.url).searchParams.get('aplicar') === '1'

  if (aplicar) {
    const r = await configurarWebhookEvolution()
    return NextResponse.json({ acao: 'aplicado', ...r }, { status: r.ok ? 200 : 502 })
  }

  const atual = await lerWebhookEvolution().catch(e => ({ erro: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({
    urlEsperada: webhookUrlEvolution(),
    atual,
    dica: 'Abra esta mesma URL com ?aplicar=1 para configurar o webhook automaticamente.',
  })
}
