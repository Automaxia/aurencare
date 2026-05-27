import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const SYS = `Classifique o TOM de um turno de psicoterapia em UMA das seis categorias:
- calm     (calmo, sereno, regulado)
- tense    (tenso, retraído, defensivo)
- open     (aberto, refletido, vulnerável)
- closed   (fechado, evasivo, monossilábico)
- anxious  (ansioso, ruminativo, acelerado)
- acolhedor (acolhedor, validador — geralmente do psicólogo)

Critérios:
- "acolhedor" é usado para a psicóloga oferecendo presença empática.
- "open" é usado para o paciente que está em contato com sua experiência interna.
- Responda APENAS com a categoria, sem prosa, sem markdown.
- Se incerto, responda "calm".`

export async function POST(req: Request, _: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const texto = String(body?.texto ?? '').slice(0, 800)
  const who = body?.who as 'psicologo' | 'paciente' | undefined

  if (!texto || texto.length < 10) return NextResponse.json({ tone: null })

  const user = `Falante: ${who === 'psicologo' ? 'psicóloga' : 'paciente'}\nTurno: "${texto}"`
  const raw = (await chat(SYS, [{ role: 'user', content: user }], { scope: 'ia.tom', maxTokens: 12 })).trim().toLowerCase()
  const tone = ['calm', 'tense', 'open', 'closed', 'anxious', 'acolhedor'].find(t => raw.includes(t)) ?? null
  return NextResponse.json({ tone })
}
