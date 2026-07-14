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
  // Métricas de silêncio (Tarefa 2a): { audioMs, speechMs, turnos, primeiroMs, ultimoMs }.
  const stats = body?.transcricaoStats && typeof body.transcricaoStats.audioMs === 'number'
    ? body.transcricaoStats : null

  await encerrarSessao(params.id, { transcricao, indicadores, transcricaoStats: stats })

  // Confirmação pós-sessão pelo paciente (proteção §10).
  // Fire-and-forget — falha aqui não pode quebrar o encerramento.
  enviarConfirmacaoPosSessao(params.id).catch(err =>
    log.err('encerrar', 'falha ao disparar confirmação', err),
  )

  // Gera rascunho de resumo automaticamente (Anthropic + aiGuard).
  const sessao = await buscarSessao(params.id)
  // IDEMPOTÊNCIA: se o laudo já foi gerado (ex.: retry após timeout do nginx onde o
  // servidor terminou e salvou, ou duplo-clique em "Encerrar"), devolve o existente
  // em vez de regerar. Evita dupla cobrança do modelo forte (~R$0,27/laudo) E do
  // custo de transcrição — protege a margem sem mudar a experiência (o retry queria
  // justamente o laudo salvo).
  if (sessao?.resumoIa) {
    return NextResponse.json({ ok: true, resumo: sessao.resumoIa })
  }
  if (sessao && transcricao.length > 40) {
    // Custo AssemblyAI. Se o cliente mandou a duração REAL transmitida (stats.audioMs),
    // usa ela (estimado=false); senão cai na estimativa pela duração agendada.
    const segundosReais = stats && stats.audioMs > 0 ? Math.round(stats.audioMs / 1000) : null
    registrarCustoAssemblyEstimado({
      segundos: segundosReais ?? (sessao.duracaoMin || 50) * 60,
      estimado: segundosReais == null,
      psicologoId: sessao.psicologoId, sessaoId: sessao.id, pacienteId: sessao.pacienteId,
    }).catch(() => {})
    // Laudos anteriores do paciente → "Avaliação do Progresso" compara de verdade.
    try {
      const historico = await resumosAnteriores(sessao.psicologoId, sessao.pacienteId, sessao.numero)
        .catch(() => [])
      const resumo = await gerarResumoSessao(transcricao, { numero: sessao.numero, pacienteNome: sessao.pacienteNome, psicologoId: sessao.psicologoId, sessaoId: sessao.id, pacienteId: sessao.pacienteId }, historico)
      // Se a IA está fora (sem crédito/erro), NÃO salva o placeholder como laudo —
      // sinaliza pro front mostrar estado claro em vez de "[Não foi possível…]".
      if (iaIndisponivel(resumo)) {
        log.warn('encerrar', `IA indisponível ao gerar laudo sessao=${params.id} — laudo não salvo`)
        return NextResponse.json({ ok: true, resumo: null, iaIndisponivel: true })
      }
      await salvarResumoIA(params.id, resumo)
      return NextResponse.json({ ok: true, resumo })
    } catch (err) {
      // Erro ou timeout ao gerar/salvar o laudo NÃO pode virar 500 (o cliente
      // mostraria modal vazio sem aviso). Sinaliza indisponível; o laudo pode ter
      // sido salvo no servidor mesmo após o 504 do nginx — o modal oferece "tentar
      // carregar" (GET /resumo) pra buscá-lo.
      log.err('encerrar', `falha ao gerar/salvar laudo sessao=${params.id}`, err)
      return NextResponse.json({ ok: true, resumo: null, iaIndisponivel: true })
    }
  }

  // Sem transcrição suficiente → não houve o que resumir (não é falha de IA).
  return NextResponse.json({ ok: true, resumo: null, motivo: 'sem_transcricao' })
}
