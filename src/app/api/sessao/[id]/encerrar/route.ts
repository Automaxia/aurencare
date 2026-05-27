import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { encerrarSessao, salvarResumoIA, buscarSessao } from '@/server/services/sessoes'
import { gerarResumoSessao } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  const transcricao = typeof body?.transcricao === 'string' ? body.transcricao : ''
  const indicadores = body?.indicadores ?? null

  await encerrarSessao(params.id, { transcricao, indicadores })

  // Gera rascunho de resumo automaticamente (Anthropic + aiGuard).
  const sessao = await buscarSessao(params.id)
  if (sessao && transcricao.length > 40) {
    const resumo = await gerarResumoSessao(transcricao, { numero: sessao.numero, pacienteNome: sessao.pacienteNome })
    await salvarResumoIA(params.id, resumo)
    return NextResponse.json({ ok: true, resumo })
  }

  return NextResponse.json({ ok: true, resumo: null })
}
