import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { lerSaude, lerFinanceiro } from '@/server/services/financeiro'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

export const runtime = 'nodejs'

const SYS = `Você é uma assistente de bolso de uma psicóloga clínica. Recebe alguns números da prática dela e gera de 3 a 5 OBSERVAÇÕES CURTAS, em tom amigável (não técnico, não corporativo, não financeiro-de-banco).

Regras:
- Cada observação ATÉ 22 palavras.
- Use português brasileiro, primeira pessoa do verbo conjugado em terceira ("sua semana", "seu mês", "seus pacientes").
- Não invente número que não foi dado. Se um indicador estiver ausente, ignore-o.
- Misture financeiro com prática (não só dinheiro): comparecimento, retenção, dias de pico, padrões úteis.
- Não emita diagnóstico nem julgamento da prática. NÃO use jargão clínico nem termos como "ROI", "KPI", "performance", "churn".
- Quando notar algo positivo, celebre brevemente. Quando notar atenção, sugira observar — nunca prescreva.

Retorne EXCLUSIVAMENTE JSON (sem markdown, sem prosa):
{
  "insights": [
    { "tom": "positivo|atencao|neutro", "texto": "..." }
  ]
}`

export async function GET() {
  const user = await requirePsicologo()

  const cacheKey = `saude-insights:${user.id}`
  const r = await redis()
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) {
      try { return NextResponse.json({ insights: JSON.parse(cached) }) } catch { /* */ }
    }
  }

  const [saude, fin] = await Promise.all([
    lerSaude(user.id),
    lerFinanceiro(user.id, new Date().toISOString()),
  ])

  const fmt = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : `R$ ${Math.round(v)}`

  const dados = [
    `Sessões esta semana: ${saude.sessoesSemana}`,
    `Sessões neste mês: ${saude.sessoesMes}`,
    `Sessões que deveriam ter acontecido (90d): ${saude.sessoesPassadas90d}`,
    `De fato aconteceram (90d): ${saude.sessoesConcluidas90d}`,
    `Sem comparecimento (90d): ${saude.noShows90d}`,
    `Cancelamentos (90d): ${saude.cancelamentos90d}`,
    `Taxa de comparecimento: ${saude.taxaComparecimentoPct.toFixed(0)}%`,
    `Taxa de falta+cancelamento: ${saude.taxaCancelamentoPct.toFixed(0)}%`,
    `Valor médio por sessão: ${fmt(saude.ticketMedio)}`,
    `Pacientes ativos: ${saude.pacientesAtivos}`,
    `Pacientes com sessão nos últimos 30 dias: ${saude.pacientesComRecente30d}`,
    `Retenção (30d): ${saude.retencaoPct.toFixed(0)}%`,
    `Recebido neste mês: ${fmt(fin.totaisMes.recebido)}`,
    `Pendente neste mês: ${fmt(fin.totaisMes.pendente)}`,
    `Inadimplência neste mês: ${fin.inadimplenciaPct.toFixed(0)}%`,
  ].join('\n')

  const raw = await chat(SYS, [{ role: 'user', content: dados }], { scope: 'saude.insights', maxTokens: 500 })

  let insights: Array<{ tom: string; texto: string }> = []
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const json = m ? JSON.parse(m[0]) : {}
    if (Array.isArray(json.insights)) {
      insights = json.insights.slice(0, 5).map((it: any) => ({
        tom: ['positivo','atencao','neutro'].includes(it.tom) ? it.tom : 'neutro',
        texto: String(it.texto ?? '').slice(0, 200),
      })).filter((it: { texto: string }) => it.texto.length > 4)
    }
  } catch { /* */ }

  if (r && insights.length > 0) await r.set(cacheKey, JSON.stringify(insights), { EX: 12 * 3600 })

  return NextResponse.json({ insights })
}
