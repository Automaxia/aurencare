import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS = `Você analisa UMA sessão de psicoterapia em relação ao histórico do paciente.
Em ATÉ 120 PALAVRAS, gere um insight contextual que compare:
- O que se manteve consistente com sessões anteriores
- O que mudou (avanço, retrocesso, novo tema)
- Padrões observáveis em frequência ou intensidade

NÃO interprete clinicamente. NÃO emita diagnóstico. Use linguagem observacional
("observa-se", "co-ocorre", "frequência maior que sessão #X", "primeiro relato de").

Português brasileiro. Um único parágrafo conciso, sem listas.`

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
