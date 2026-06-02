import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'

export const runtime = 'nodejs'

const SYS = `${CLINICAL_VOICE}

TAREFA: identificar momentos-chave nos turnos de uma sessão e sugerir marcação.

CATEGORIAS (marque APENAS turnos com who="paciente"):
- "insight"        — paciente articula uma conexão nova entre eventos, sentimentos ou comportamentos; expressa uma percepção que parece inédita na fala dele(a).
- "comportamento"  — relato concreto de um padrão de ação repetido que aparece como sofrimento ou bloqueio (evitação, isolamento, ruminação, reatividade, postergação, conflito interpessoal recorrente).
- "avanco"         — relato de uma tentativa concreta de fazer algo diferente, conclusão sustentada de etapa anterior, ou pequena mudança observada desde a última sessão.

CRITÉRIOS DE QUALIDADE:
- Máximo 6 marcações. Prefira poucas e bem ancoradas a muitas e fracas.
- Sempre que possível, prefira turnos com verbos no presente ou pretérito perfeito ('percebi que', 'consegui') — sinais textuais mais fortes.
- "razao" deve citar a pista textual do próprio turno (até 12 palavras). Ex.: "primeira vez que conecta culpa ao trabalho".

NÃO emita diagnóstico nem interpretação. Use vocabulário descritivo.

Retorne EXCLUSIVAMENTE JSON válido (sem prosa, sem markdown):
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
