import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { encerrarSessao, salvarResumoCurto, buscarSessao } from '@/server/services/sessoes'
import { gerarResumoCurto, iaIndisponivel } from '@/server/lib/anthropic'
import { enviarConfirmacaoPosSessao } from '@/server/services/confirmacaoSessao'
import { registrarCustoAssemblyEstimado } from '@/server/services/custos'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  const transcricao = typeof body?.transcricao === 'string' ? body.transcricao : ''
  const indicadores = body?.indicadores ?? null
  // Métricas de silêncio (Tarefa 2a): { audioMs, speechMs, turnos, primeiroMs, ultimoMs }.
  const stats = body?.transcricaoStats && typeof body.transcricaoStats.audioMs === 'number'
    ? body.transcricaoStats : null

  try {
    await encerrarSessao(user.id, params.id, { transcricao, indicadores, transcricaoStats: stats })
  } catch {
    // Não é dono (ou não existe): nada abaixo pode rodar — o que vem depois
    // grava prontuário, dispara WhatsApp ao paciente e gera resumo por IA.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Confirmação pós-sessão pelo paciente (proteção §10).
  // Fire-and-forget — falha aqui não pode quebrar o encerramento.
  enviarConfirmacaoPosSessao(params.id).catch(err =>
    log.err('encerrar', 'falha ao disparar confirmação', err),
  )

  // Resumo CURTO automático (modelo fast, barato). O laudo formal CFP (modelo forte)
  // é gerado SOB DEMANDA em POST /api/sessao/[id]/laudo — não em toda sessão.
  const sessao = await buscarSessao(params.id)
  // IDEMPOTÊNCIA: se já há resumo curto (retry após timeout / duplo-clique), devolve
  // o existente — evita dupla cobrança do resumo e da transcrição.
  if (sessao?.resumoCurto) {
    return NextResponse.json({ ok: true, resumo: sessao.resumoCurto })
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
    try {
      const resumo = await gerarResumoCurto(transcricao, { numero: sessao.numero, pacienteNome: sessao.pacienteNome, psicologoId: sessao.psicologoId, sessaoId: sessao.id, pacienteId: sessao.pacienteId })
      if (iaIndisponivel(resumo)) {
        log.warn('encerrar', `IA indisponível ao gerar resumo curto sessao=${params.id}`)
        return NextResponse.json({ ok: true, resumo: null, iaIndisponivel: true })
      }
      await salvarResumoCurto(params.id, resumo)
      return NextResponse.json({ ok: true, resumo })
    } catch (err) {
      log.err('encerrar', `falha ao gerar/salvar resumo curto sessao=${params.id}`, err)
      return NextResponse.json({ ok: true, resumo: null, iaIndisponivel: true })
    }
  }

  // Sem transcrição suficiente → não houve o que resumir (não é falha de IA).
  return NextResponse.json({ ok: true, resumo: null, motivo: 'sem_transcricao' })
}
