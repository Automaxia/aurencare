import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { encerrarSessao, salvarResumoIA, buscarSessao, resumosAnteriores } from '@/server/services/sessoes'
import { gerarResumoSessao, iaIndisponivel } from '@/server/lib/anthropic'
import { enviarConfirmacaoPosSessao } from '@/server/services/confirmacaoSessao'
import { registrarCustoAssemblyEstimado } from '@/server/services/custos'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  const transcricao = typeof body?.transcricao === 'string' ? body.transcricao : ''
  const indicadores = body?.indicadores ?? null

  await encerrarSessao(params.id, { transcricao, indicadores })

  // Confirmação pós-sessão pelo paciente (proteção §10).
  // Fire-and-forget — falha aqui não pode quebrar o encerramento.
  enviarConfirmacaoPosSessao(params.id).catch(err =>
    log.err('encerrar', 'falha ao disparar confirmação', err),
  )

  // Gera rascunho de resumo automaticamente (Anthropic + aiGuard).
  const sessao = await buscarSessao(params.id)
  if (sessao && transcricao.length > 40) {
    // Custo AssemblyAI: estimado pela duração da sessão (streaming é client-side).
    // Só quando houve transcrição de fato (sessão real).
    registrarCustoAssemblyEstimado({
      segundos: (sessao.duracaoMin || 50) * 60,
      psicologoId: sessao.psicologoId, sessaoId: sessao.id,
    }).catch(() => {})
    // Laudos anteriores do paciente → "Avaliação do Progresso" compara de verdade.
    const historico = await resumosAnteriores(sessao.psicologoId, sessao.pacienteId, sessao.numero)
      .catch(() => [])
    const resumo = await gerarResumoSessao(transcricao, { numero: sessao.numero, pacienteNome: sessao.pacienteNome }, historico)
    // Se a IA está fora (sem crédito/erro), NÃO salva o placeholder como laudo —
    // sinaliza pro front mostrar estado claro em vez de "[Não foi possível…]".
    if (iaIndisponivel(resumo)) {
      log.warn('encerrar', `IA indisponível ao gerar laudo sessao=${params.id} — laudo não salvo`)
      return NextResponse.json({ ok: true, resumo: null, iaIndisponivel: true })
    }
    await salvarResumoIA(params.id, resumo)
    return NextResponse.json({ ok: true, resumo })
  }

  return NextResponse.json({ ok: true, resumo: null })
}
