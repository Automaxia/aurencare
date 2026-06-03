import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { chat } from '@/server/lib/anthropic'

export const runtime = 'nodejs'

const TONES = ['calm', 'tense', 'open', 'closed', 'anxious', 'acolhedor'] as const
type Tone = (typeof TONES)[number]

const SYS = `Classifique o TOM de CADA turno de psicoterapia em UMA das seis categorias:
- calm     (calmo, sereno, regulado)
- tense    (tenso, retraído, defensivo)
- open     (aberto, refletido, vulnerável)
- closed   (fechado, evasivo, monossilábico)
- anxious  (ansioso, ruminativo, acelerado)
- acolhedor (acolhedor, validador — geralmente do psicólogo)

Critérios:
- "acolhedor" é usado para a psicóloga oferecendo presença empática.
- "open" é usado para o paciente que está em contato com sua experiência interna.
- Se incerto, use "calm".

Os turnos chegam numerados (0, 1, 2, …). Responda APENAS com um array JSON de
categorias, NA MESMA ORDEM e com o MESMO número de itens dos turnos recebidos.
Exemplo para 3 turnos: ["calm","open","tense"]
Sem prosa, sem markdown, sem chaves — só o array.`

type TurnoIn = { texto: string; who?: 'psicologo' | 'paciente' }

export async function POST(req: Request, _: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))

  // Aceita lote ({ turnos: [...] }) ou turno único ({ texto, who }) por compat.
  const brutos: TurnoIn[] = Array.isArray(body?.turnos)
    ? body.turnos
    : body?.texto ? [{ texto: body.texto, who: body.who }] : []

  // Mantém referência ao índice original: turnos curtos não vão pra IA, mas
  // ainda devolvemos um slot (null) pra alinhar o array de resposta no client.
  const turnos = brutos.slice(0, 8).map(t => ({
    texto: String(t?.texto ?? '').slice(0, 800),
    who: t?.who === 'psicologo' ? 'psicóloga' : 'paciente',
  }))

  const classificaveis = turnos.filter(t => t.texto.length >= 10)
  if (classificaveis.length === 0) {
    return NextResponse.json({ tones: turnos.map(() => null) })
  }

  const lista = classificaveis
    .map((t, i) => `${i}. (${t.who}) "${t.texto}"`)
    .join('\n')
  const raw = await chat(SYS, [{ role: 'user', content: lista }], {
    scope: 'ia.tom', maxTokens: 80,
  })

  // Parse robusto: extrai o primeiro array JSON da resposta.
  let parsed: string[] = []
  try {
    const m = raw.match(/\[[\s\S]*\]/)
    if (m) parsed = JSON.parse(m[0])
  } catch { /* fallback abaixo */ }

  const norm = (v: unknown): Tone => {
    const s = String(v ?? '').trim().toLowerCase()
    return TONES.find(t => s.includes(t)) ?? 'calm'
  }

  // Realinha as classificações (só dos classificáveis) de volta aos slots originais.
  let k = 0
  const tones = turnos.map(t =>
    t.texto.length >= 10 ? norm(parsed[k++]) : null,
  )

  return NextResponse.json({ tones, tone: tones.find(Boolean) ?? null })
}
