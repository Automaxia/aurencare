import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { reenviarCobranca } from '@/server/services/sessoes'
import { log } from '@/server/lib/log'

/**
 * Motivos que o psicólogo consegue resolver sozinho. Devolvidos com o código,
 * para o pós-sessão dizer O QUE fazer: "falhou, tente de novo" é uma parede
 * quando o que falta é o CPF do paciente — tentar de novo nunca vai funcionar.
 */
const MOTIVOS_ACIONAVEIS = new Set([
  'cpf_paciente_ausente',
  'cpf_paciente_invalido',
  'recebimento_nao_configurado',
  'sessao_nao_encontrada',
])

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  try {
    await reenviarCobranca(user.id, params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const motivo = err instanceof Error ? err.message : ''
    // Sessão de outro psicólogo cai aqui como 'sessao_nao_encontrada' — mesmo
    // corpo que uma sessão inexistente, pra não confirmar a existência do id.
    if (motivo === 'sessao_nao_encontrada') {
      return NextResponse.json({ error: motivo }, { status: 404 })
    }
    if (MOTIVOS_ACIONAVEIS.has(motivo)) {
      return NextResponse.json({ error: motivo }, { status: 409 })
    }
    log.err('reenviar-cobranca', `sessao=${params.id}`, err)
    return NextResponse.json({ error: 'falha' }, { status: 500 })
  }
}
