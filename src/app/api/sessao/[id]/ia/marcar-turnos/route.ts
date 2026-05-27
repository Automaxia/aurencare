import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const SYS = `Você recebe os turnos de uma sessão de psicoterapia já transcritos e numerados.
Para cada turno relevante, sugira UMA marcação entre:
- "insight"        — momento em que paciente articula consciência nova ou conexão entre padrões
- "comportamento"  — descrição de comportamento-problema (evitação, ruminação, conflito reativo etc)
- "avanco"         — relato de tentativa concreta de mudança ou pequeno avanço terapêutico

Critérios:
- Marque APENAS turnos de paciente (who="paciente") que claramente caem em uma das categorias.
- Máximo 6 marcações por sessão. Prefira qualidade.
- Para cada uma, dê uma "razao" curta (até 12 palavras).

NÃO interprete clinicamente nem emita diagnóstico. Use linguagem de observação.

Retorne EXCLUSIVAMENTE um JSON válido neste formato (sem prosa, sem markdown):
{"marcacoes":[{"idx":0,"mark":"insight","razao":"..."}]}`

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  void params
  const body = await req.json().catch(() => ({}))
  const turnos = Array.isArray(body?.turnos) ? body.turnos : []
  if (turnos.length === 0) return NextResponse.json({ marcacoes: [] })

  const userMsg = turnos
    .map((t: any) => `[${t.idx}] ${t.who === 'psicologo' ? 'P' : 'C'}: ${t.texto}`)
    .join('\n')

  const raw = await chat(SYS, [{ role: 'user', content: userMsg }], { scope: 'ia.marcar-turnos', maxTokens: 700 })

  // Parse defensivo
  let marcacoes: Array<{ idx: number; mark: string; razao: string }> = []
  try {
    const json = JSON.parse(extractJson(raw))
    if (Array.isArray(json?.marcacoes)) marcacoes = json.marcacoes
  } catch { /* mantém vazio */ }

  // Filtra valores válidos
  const validas = marcacoes
    .filter(m => typeof m.idx === 'number' && ['insight', 'comportamento', 'avanco'].includes(m.mark))
    .slice(0, 6)

  return NextResponse.json({ marcacoes: validas })
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/)
  return m ? m[0] : '{}'
}
