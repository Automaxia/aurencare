import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { contextoCorrecao, transferirRegistro, arquivarSessao } from '@/server/services/correcaoSessao'

export const runtime = 'nodejs'

/** GET — dados pra montar o fluxo de correção (destinos possíveis + dados do termo). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const ctx = await contextoCorrecao(user.id, params.id)
  if (!ctx) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  return NextResponse.json({
    psicologoNome: ctx.psicologoNome,
    crp: ctx.crp,
    sessao: {
      numero: ctx.sessao.numero, dataHora: ctx.sessao.dataHora,
      pacienteId: ctx.sessao.pacienteId, pacienteNome: ctx.sessao.pacienteNome,
      pagamentoStatus: ctx.sessao.pagamentoStatus,
    },
    destinos: ctx.destinos,
  })
}

/**
 * POST — executa a correção.
 * Body: { acao: 'transferir_registro' | 'excluir', motivo, confirmacao, aceiteTermo: true,
 *         destinoPacienteId?, destinoSessaoId? }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  if (body?.aceiteTermo !== true) return NextResponse.json({ ok: false, erro: 'É preciso aceitar o termo de responsabilidade.' }, { status: 400 })

  const auditoria = {
    motivo: String(body?.motivo ?? ''),
    confirmacao: String(body?.confirmacao ?? ''),
    ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  }

  let r
  if (body?.acao === 'transferir_registro') {
    const destinoPacienteId = typeof body.destinoPacienteId === 'string' ? body.destinoPacienteId : ''
    if (!destinoPacienteId) return NextResponse.json({ ok: false, erro: 'Escolha o paciente de destino.' }, { status: 400 })
    r = await transferirRegistro(user.id, params.id, {
      pacienteId: destinoPacienteId,
      sessaoId: typeof body.destinoSessaoId === 'string' && body.destinoSessaoId ? body.destinoSessaoId : null,
    }, auditoria)
  } else if (body?.acao === 'excluir') {
    r = await arquivarSessao(user.id, params.id, auditoria)
  } else {
    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 })
  }
  return NextResponse.json(r, { status: r.ok ? 200 : 422 })
}
