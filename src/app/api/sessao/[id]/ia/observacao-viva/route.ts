import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'

export const runtime = 'nodejs'

const SYS = `${CLINICAL_VOICE}

TAREFA: gerar UMA observação muito breve enquanto a sessão está em curso, para a psicóloga ler de canto de olho.

Em ATÉ 30 PALAVRAS:
- Aponte UM padrão emergente nesta sessão: repetição de tema, co-ocorrência, mudança de tom, primeira menção, retomada.
- Quando puder, ancore numa pista textual ('depois de mencionar X, retomou Y').
- Se ainda não há padrão claro, retorne EXATAMENTE: "Conversa em desenvolvimento — sem padrão claro ainda."

Um único parágrafo curto. NUNCA mais que 30 palavras. NUNCA cite o paciente pelo nome. NUNCA prescreva ação.`

export async function POST(req: Request, _: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const turnos = Array.isArray(body?.turnos) ? body.turnos.slice(-12) : []

  if (turnos.length < 3) return NextResponse.json({ text: null })

  const userMsg = turnos
    .map((t: any) => `${t.who === 'psicologo' ? 'P' : 'C'}: ${String(t.texto).slice(0, 300)}`)
    .join('\n')

  const text = await chat(SYS, [{ role: 'user', content: userMsg }], { scope: 'ia.obs-viva', maxTokens: 80 })
  return NextResponse.json({ text })
}
