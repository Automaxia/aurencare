import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'

export const runtime = 'nodejs'

const SYS = `${CLINICAL_VOICE}

TAREFA: graduar o nível de risco observado em 3 dimensões, ancorando-se SEMPRE na evidência textual da transcrição.

DIMENSÕES:
- autolesao  — relatos de ferir-se, machucar o corpo, queimar, cortar, atos com intenção de dor física
- ideacao    — pensamentos sobre morrer, deixar de existir, não querer continuar, desaparecer
- plano      — especificidade de método, local, data, acesso a meios, recado-despedida, organização de pendências

CRITÉRIOS:
- Baixo (lo)  — sem menção textual; ausência ativa do tema na fala
- Médio (md)  — menção indireta ou passiva ('às vezes queria sumir'), histórico verbal, ambivalência sustentada
- Alto (hi)   — relato direto, frequência atual descrita, especificidade observável

REGRAS DE CONSERVADORISMO:
- Na dúvida entre dois níveis, fique com o MAIOR (vigilância clínica > falso conforto).
- Se houver indício textual claro de Alto em qualquer dimensão, "justificativa" DEVE citar o trecho entre aspas.

Retorne EXCLUSIVAMENTE JSON válido (sem prosa, sem markdown):
{"autolesao":"lo|md|hi","ideacao":"lo|md|hi","plano":"lo|md|hi","justificativa":"até 30 palavras, citando trecho se houver"}`

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
