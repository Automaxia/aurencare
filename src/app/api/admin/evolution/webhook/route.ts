import { NextResponse } from 'next/server'
import { requireRole } from '@/server/lib/auth'
import { lerWebhookEvolution, configurarWebhookEvolution, webhookUrlEvolution } from '@/server/lib/evolution'

export const dynamic = 'force-dynamic'

/**
 * Admin: diagnostica/configura o webhook da instância Evolution.
 * - GET  → mostra o webhook atual + a URL esperada (somente leitura)
 * - POST → aponta o webhook pro app (MESSAGES_UPSERT etc.)
 *
 * Exige papel `admin`, não só sessão: a instância Evolution é COMPARTILHADA
 * entre todos os psicólogos, e o cadastro é aberto — qualquer conta nova
 * conseguia ler e reescrever essa configuração.
 *
 * A escrita saiu do GET ?aplicar=1 pra POST porque o cookie de sessão é
 * SameSite=Lax e acompanha navegação top-level: um link bastava pra acionar a
 * reconfiguração no navegador de um admin logado (CSRF).
 * Sem MESSAGES_UPSERT apontando pra cá, as respostas do paciente (PIX/CREDITO/…)
 * não chegam e o fluxo de pagamento trava.
 */
export async function POST() {
  await requireRole('admin')
  const r = await configurarWebhookEvolution()
  return NextResponse.json({ acao: 'aplicado', ...r }, { status: r.ok ? 200 : 502 })
}

export async function GET() {
  await requireRole('admin')

  const atual = await lerWebhookEvolution().catch(e => ({ erro: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({
    urlEsperada: webhookUrlEvolution(),
    atual,
    dica: 'Faça POST nesta mesma URL para configurar o webhook automaticamente.',
  })
}
