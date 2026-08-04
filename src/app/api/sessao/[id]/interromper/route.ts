import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { interromperSessao } from '@/server/services/sessoes'

export const runtime = 'nodejs'

/**
 * "Encerrar sem registrar": a sessão começou mas não aconteceu. Devolve pra fila
 * e não gera resumo, não grava transcrição e não avisa o paciente — ao contrário
 * de POST /encerrar, que conclui e vira prontuário.
 *
 * Nada do corpo é lido de propósito: o cliente não manda a transcrição parcial,
 * então não há o que descartar no servidor.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const r = await interromperSessao(user.id, params.id)
  if (r.ok) return NextResponse.json({ ok: true, status: r.status })

  const status = r.motivo === 'nao_encontrada' ? 404 : 409
  const erro = {
    nao_encontrada: 'Sessão não encontrada.',
    nao_iniciada: 'Esta sessão não está em curso.',
    tem_registro: 'Esta sessão já tem registro clínico — encerre normalmente.',
  }[r.motivo]
  return NextResponse.json({ ok: false, motivo: r.motivo, erro }, { status })
}
