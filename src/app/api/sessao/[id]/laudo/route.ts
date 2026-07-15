import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao, salvarLaudo, resumosAnteriores } from '@/server/services/sessoes'
import { gerarLaudoFormal, iaIndisponivel } from '@/server/lib/anthropic'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

/**
 * POST /api/sessao/[id]/laudo — gera o LAUDO FORMAL (CFP) sob demanda, com o
 * modelo forte. Documento esporádico: só roda quando o psicólogo pede (CFP /
 * pedido do paciente), preservando margem. Vive em coluna PRÓPRIA (`laudo`) —
 * NÃO toca o registro de continuidade (resumo_ia). Idempotente: se o laudo já
 * existe, devolve o salvo (não regera nem recobra).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (sessao.psicologoId !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Já existe → devolve (idempotente, sem custo).
  if (sessao.laudo) return NextResponse.json({ ok: true, laudo: sessao.laudo, jaExistia: true })

  const transcricao = sessao.transcricao ?? ''
  if (transcricao.length <= 40) {
    return NextResponse.json({ ok: false, motivo: 'sem_transcricao' }, { status: 422 })
  }

  try {
    const historico = await resumosAnteriores(sessao.psicologoId, sessao.pacienteId, sessao.numero).catch(() => [])
    const laudo = await gerarLaudoFormal(transcricao, {
      numero: sessao.numero, pacienteNome: sessao.pacienteNome,
      psicologoId: sessao.psicologoId, sessaoId: sessao.id, pacienteId: sessao.pacienteId,
    }, historico)
    if (iaIndisponivel(laudo)) {
      return NextResponse.json({ ok: false, iaIndisponivel: true }, { status: 503 })
    }
    await salvarLaudo(params.id, laudo)
    return NextResponse.json({ ok: true, laudo })
  } catch (err) {
    log.err('laudo', `falha ao gerar laudo formal sessao=${params.id}`, err)
    return NextResponse.json({ ok: false, iaIndisponivel: true }, { status: 503 })
  }
}
