import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const SYS = `Você gera uma OBSERVAÇÃO MUITO BREVE para a psicóloga durante uma sessão em curso.
Recebe os últimos turnos transcritos da conversa.

Em ATÉ 30 PALAVRAS:
- Aponte UM padrão observável que está emergindo nesta sessão (frequência, co-ocorrência, mudança de tom, repetição de tema).
- Use linguagem observacional ("observa-se", "frequência crescente", "co-ocorre", "padrão repetido", "primeira menção").
- NÃO emita diagnóstico, interpretação clínica, recomendação ou hipótese.
- Se ainda não há padrão claro, retorne EXATAMENTE: "Conversa em desenvolvimento — sem padrão claro ainda."

Português brasileiro. Um único parágrafo curto. NUNCA mais que 30 palavras. NUNCA cite o paciente pelo nome.`

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
