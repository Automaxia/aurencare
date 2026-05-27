import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const SYS = `Você avalia uma transcrição de psicoterapia para sugerir níveis de risco em 3 dimensões:
- autolesao  (Baixo/Médio/Alto)
- ideacao    (Baixo/Médio/Alto)  — ideação suicida
- plano      (Baixo/Médio/Alto)  — plano específico

Critérios:
- Baixo  = sem menção explícita ou indícios mínimos
- Médio  = menção indireta, ideias passivas ("não queria mais existir"), histórico mencionado
- Alto   = relato direto, frequência atual, especificidade de plano/método/data

NÃO emita diagnóstico. NÃO use jargão clínico. Use linguagem observacional.

Retorne EXCLUSIVAMENTE JSON válido (sem prosa, sem markdown):
{"autolesao":"lo|md|hi","ideacao":"lo|md|hi","plano":"lo|md|hi","justificativa":"até 30 palavras"}

Onde lo=Baixo, md=Médio, hi=Alto.`

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  void params
  const body = await req.json().catch(() => ({}))
  const transcricao = String(body?.transcricao ?? '').slice(0, 12_000)
  if (!transcricao) return NextResponse.json({ error: 'sem_transcricao' }, { status: 400 })

  const raw = await chat(SYS, [{ role: 'user', content: transcricao }], { scope: 'ia.risco', maxTokens: 200 })

  try {
    const json = JSON.parse(extractJson(raw))
    const valid = (v: any) => ['lo', 'md', 'hi'].includes(v) ? v : 'lo'
    return NextResponse.json({
      autolesao: valid(json.autolesao),
      ideacao:   valid(json.ideacao),
      plano:     valid(json.plano),
      justificativa: String(json.justificativa ?? '').slice(0, 200),
    })
  } catch {
    return NextResponse.json({ autolesao: 'lo', ideacao: 'lo', plano: 'lo', justificativa: 'Sem indicadores observados.' })
  }
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/)
  return m ? m[0] : '{}'
}
