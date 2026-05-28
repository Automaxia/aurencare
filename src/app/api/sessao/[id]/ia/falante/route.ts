import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const SYS = `Você classifica quem está falando em um turno de psicoterapia.
Recebe o texto do turno e até 3 turnos anteriores (com seus falantes já confirmados).

Responda APENAS uma das duas palavras (sem prosa, sem markdown):
- "psicologo"  — quando o turno parece da psicóloga: faz pergunta exploratória, valida, oferece reformulação, redireciona, observa, acolhe.
- "paciente"   — quando o turno parece do paciente: descreve sua própria experiência, sentimentos, eventos autobiográficos, queixas, dúvidas pessoais.

Critérios:
- Padrão psicólogo: "Como você se sentiu?", "Obrigada por compartilhar", "Vamos respeitar esse espaço", "O que ficou disso?", "Notou alguma coisa?"
- Padrão paciente: "Eu fiquei", "Senti que", "Aconteceu que", "Minha mãe", "No trabalho", "Tive medo de"
- Em caso de ambiguidade real, mantenha continuidade com o turno anterior (provavelmente é a mesma pessoa continuando).
- NÃO invente análise nem comente nada. Só responda a palavra.`

export async function POST(req: Request, _: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const texto = String(body?.texto ?? '').slice(0, 600)
  const contexto = Array.isArray(body?.contexto) ? body.contexto.slice(-3) : []

  if (!texto || texto.length < 6) return NextResponse.json({ who: null })

  const ctx = contexto
    .map((c: any) => `${c.who === 'psicologo' ? 'PSICOLOGA' : 'PACIENTE'}: "${String(c.texto).slice(0, 200)}"`)
    .join('\n')

  const user = `${ctx ? 'Contexto recente:\n' + ctx + '\n\n' : ''}Turno a classificar:\n"${texto}"`
  const raw = (await chat(SYS, [{ role: 'user', content: user }], { scope: 'ia.falante', maxTokens: 8 })).trim().toLowerCase()

  let who: 'psicologo' | 'paciente' | null = null
  if (raw.includes('psicolog')) who = 'psicologo'
  else if (raw.includes('paciente')) who = 'paciente'

  return NextResponse.json({ who })
}
