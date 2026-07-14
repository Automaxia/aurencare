import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao, salvarResumoIA, resumosAnteriores } from '@/server/services/sessoes'
import { gerarResumoSessao, iaIndisponivel } from '@/server/lib/anthropic'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * POST /api/sessao/[id]/laudo — gera o LAUDO FORMAL (CFP) sob demanda, com o
 * modelo forte. Diferente do resumo curto automático do encerramento: este só
 * roda quando o psicólogo pede (CFP / pedido do paciente), preservando margem.
 * Idempotente: se o laudo já existe, devolve o salvo (não regera nem recobra).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (sessao.psicologoId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Já existe → devolve (idempotente, sem custo).
  if (sessao.resumoIa) return NextResponse.json({ ok: true, resumo: sessao.resumoIa, jaExistia: true })

  const transcricao = sessao.transcricao ?? ''
  if (transcricao.length <= 40) {
    return NextResponse.json({ ok: false, motivo: 'sem_transcricao' }, { status: 422 })
  }

  try {
    const historico = await resumosAnteriores(sessao.psicologoId, sessao.pacienteId, sessao.numero).catch(() => [])
    const laudo = await gerarResumoSessao(transcricao, {
      numero: sessao.numero, pacienteNome: sessao.pacienteNome,
      psicologoId: sessao.psicologoId, sessaoId: sessao.id, pacienteId: sessao.pacienteId,
    }, historico)
    if (iaIndisponivel(laudo)) {
      return NextResponse.json({ ok: false, iaIndisponivel: true }, { status: 503 })
    }
    await salvarResumoIA(params.id, laudo)
    return NextResponse.json({ ok: true, resumo: laudo })
  } catch (err) {
    log.err('laudo', `falha ao gerar laudo formal sessao=${params.id}`, err)
    return NextResponse.json({ ok: false, iaIndisponivel: true }, { status: 503 })
  }
}
