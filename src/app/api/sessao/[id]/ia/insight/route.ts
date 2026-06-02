import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { chat } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS = `${CLINICAL_VOICE}

TAREFA: gerar uma leitura contextual da sessão atual em relação ao histórico do(a) paciente.

Em ATÉ 120 PALAVRAS, em UM parágrafo (sem listas):
- Continuidade: o que persiste das sessões anteriores, e desde quando (cite sessão #N).
- Mudança: o que apareceu pela primeira vez, o que reduziu, o que se intensificou.
- Padrão: alguma co-ocorrência ou variação de frequência/intensidade que mereça observação.

REGRAS:
- Cite NÚMERO da sessão sempre que comparar ('em relação à sessão #4').
- Quando uma observação for fina, ancore em pista textual breve.
- Encerre com uma frase orientadora (NÃO prescritiva): 'pode ser útil observar X na próxima escuta'.`

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()

  const { rows } = await db.query<{
    id: string; numero: number; data_hora: string;
    paciente_id: string; psicologo_id: string;
    transcricao_texto: string | null; resumo_ia: string | null;
    indicadores: any;
  }>(
    `SELECT id, numero, data_hora, paciente_id, psicologo_id,
            transcricao_texto, resumo_ia, indicadores
       FROM sessoes WHERE id = $1 LIMIT 1`, [params.id],
  )
  const s = rows[0]
  if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (s.psicologo_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cacheKey = `sessao-insight:${s.id}`
  const r = await redis()
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) return NextResponse.json({ text: cached, cached: true })
  }

  const transcricao = tryDecrypt(s.transcricao_texto) ?? tryDecrypt(s.resumo_ia) ?? ''
  if (!transcricao) return NextResponse.json({ text: null })

  // Sessões anteriores assinadas (até 3 mais recentes).
  const { rows: ant } = await db.query<{ numero: number; data_hora: string; resumo_ia: string | null }>(
    `SELECT numero, data_hora, resumo_ia
       FROM sessoes
      WHERE paciente_id = $1 AND id <> $2 AND assinada = TRUE
        AND data_hora < $3
      ORDER BY data_hora DESC LIMIT 3`,
    [s.paciente_id, s.id, s.data_hora],
  )
  const historico = ant.length
    ? ant.map(a => `Sessão #${a.numero} (${new Date(a.data_hora).toLocaleDateString('pt-BR')}):\n${tryDecrypt(a.resumo_ia) ?? '(sem resumo)'}`).join('\n\n')
    : 'Sem sessões anteriores assinadas.'

  const userMsg = `Sessão atual #${s.numero}:\n"""\n${transcricao.slice(0, 6000)}\n"""\n\nSessões anteriores:\n${historico}`

  const text = await chat(SYS, [{ role: 'user', content: userMsg }], { scope: 'insight.sessao', maxTokens: 350 })

  if (r) await r.set(cacheKey, text, { EX: 86400 })
  return NextResponse.json({ text, cached: false })
}
