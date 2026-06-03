import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { lerGrafo } from './temas'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'

/**
 * Dados agregados para Evolução Registrada (página).
 * Combina dados estatísticos + observações textuais geradas pela IA.
 */

export type PerfilEvolucao = {
  avatar: string                 // iniciais
  nome: string
  totalSessoes: number
  minutosMedia: number
  desde: string                  // data primeira sessão
  presenca: number               // 0-100 (% comparecimento)
  abertura: number               // 0-100 (avg humor.estado mapeado)
  sparkHumor: number[]
  sparkRitmo: number[]
}

export type EvolucaoDados = {
  perfil: PerfilEvolucao
  temas: TemaDescritivo[]
  instrumentos: Instrumento[]
}

export type TemaDescritivo = {
  titulo: string                   // "Trabalho aparece em conjunto com medo"
  descricao: string                // "Presentes juntos em 6 das 7 sessões..."
  trend?: string                   // "Tendência de redução nas últimas semanas"
  positivo?: boolean               // se true, card recebe estilo sage
}

export type Instrumento = {
  id: 'PHQ-9' | 'GAD-7' | 'BDI-II' | 'BAI' | 'PCL-5'
  justificativa: string            // texto curto explicando por que considerar
}

/**
 * Caminho RÁPIDO usado no SSR. Só queries SQL — não chama IA.
 * Devolve perfil + sparklines. Temas/instrumentos (que vêm da IA)
 * são buscados depois pelo client via /api/pacientes/[id]/evolucao/observacoes.
 */
export async function lerEvolucaoEstatisticas(pacienteId: string, pacienteNome: string): Promise<EvolucaoDados> {
  const perfilDados = await lerPerfilEvolucao(pacienteId, pacienteNome)
  return { perfil: perfilDados, temas: [], instrumentos: [] }
}

/**
 * Caminho LENTO chamado pelo client (não bloqueia SSR). IA + Redis cache 24h.
 * Devolve só temas/instrumentos — o perfil já chegou pelo SSR.
 */
export async function lerEvolucaoObservacoes(
  pacienteId: string, pacienteNome: string,
): Promise<{ temas: TemaDescritivo[]; instrumentos: Instrumento[] }> {
  const r = await redis()
  const cacheKey = `evolucao-dados:${pacienteId}`
  if (r) {
    const cached = await r.get(cacheKey)
    if (cached) {
      try { return JSON.parse(cached) } catch { /* */ }
    }
  }

  // Conta sessões assinadas pra contexto da IA (uma query simples)
  const { rows: cnt } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE`,
    [pacienteId],
  )
  const totalAssinadas = cnt[0]?.n ?? 0

  const grafo = await lerGrafo(pacienteId)
  let temas: TemaDescritivo[] = []
  let instrumentos: Instrumento[] = []
  if (grafo.nodes.length > 0) {
    const ger = await gerarObservacoes({ pacienteNome, totalSessoes: totalAssinadas, grafo })
    temas = ger.temas
    instrumentos = ger.instrumentos
  }
  if (r) await r.set(cacheKey, JSON.stringify({ temas, instrumentos }), { EX: 86400 })
  return { temas, instrumentos }
}

/** Mantida pra compatibilidade. Chama o caminho lento — usar apenas onde a latência IA é aceitável. */
export async function lerEvolucaoDados(pacienteId: string, pacienteNome: string): Promise<EvolucaoDados> {
  const [estat, obs] = await Promise.all([
    lerEvolucaoEstatisticas(pacienteId, pacienteNome),
    lerEvolucaoObservacoes(pacienteId, pacienteNome),
  ])
  return { perfil: estat.perfil, ...obs }
}

async function lerPerfilEvolucao(pacienteId: string, pacienteNome: string) {
  // 1) Sessões assinadas (para perfil e abertura)
  const { rows: sessoesA } = await db.query<{ data_hora: string; duracao_min: number; indicadores: any }>(
    `SELECT data_hora, duracao_min, indicadores
       FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE
       ORDER BY data_hora ASC`, [pacienteId],
  )

  // 2) Sessões passadas para taxa de presença
  const { rows: sessoesP } = await db.query<{ status: string }>(
    `SELECT status FROM sessoes
      WHERE paciente_id = $1 AND data_hora < NOW()
        AND status NOT IN ('agendada','aguardando_metodo','aguardando_pagamento','confirmada')`,
    [pacienteId],
  )
  const concluidas = sessoesP.filter(s => s.status === 'concluida').length
  const presenca = sessoesP.length > 0 ? Math.round((concluidas / sessoesP.length) * 100) : 0

  // abertura = média do humor.estado (-5..5) → mapeado pra 0..100
  let abertura = 50
  if (sessoesA.length > 0) {
    const estados = sessoesA
      .map(s => s.indicadores?.humor?.estado)
      .filter((v): v is number => typeof v === 'number')
    if (estados.length > 0) {
      const avg = estados.reduce((a, b) => a + b, 0) / estados.length
      abertura = Math.round(((avg + 5) / 10) * 100)
    } else {
      // fallback: estima por concluídas/total
      abertura = sessoesA.length > 0 ? Math.min(100, 30 + sessoesA.length * 8) : 50
    }
  }

  const minutosMedia = sessoesA.length
    ? Math.round(sessoesA.reduce((a, s) => a + (s.duracao_min ?? 50), 0) / sessoesA.length)
    : 50
  const desde = sessoesA[0]?.data_hora ?? new Date().toISOString()

  // sparklines — humor e ritmo por sessão (cronológico)
  const sparkHumor: number[] = sessoesA
    .map(s => s.indicadores?.humor?.estado)
    .filter((v): v is number => typeof v === 'number')
  const sparkRitmo: number[] = sessoesA
    .map(s => s.indicadores?.ritmo?.paciente)
    .filter((v): v is number => typeof v === 'number')

  return {
    avatar: iniciais(pacienteNome),
    nome: pacienteNome,
    totalSessoes: sessoesA.length,
    minutosMedia,
    desde,
    presenca,
    abertura,
    sparkHumor,
    sparkRitmo,
  }
}

const SYS_OBS = `Você analisa o histórico clínico de um paciente para gerar OBSERVAÇÕES descritivas para a psicóloga.
Recebe: nome, total de sessões, lista de temas (palavras+cluster+frequência) e co-ocorrências.

Produza um JSON EXCLUSIVAMENTE neste formato (sem prosa, sem markdown):
{
  "temas": [
    { "titulo": "...", "descricao": "...", "trend": "...", "positivo": false }
  ],
  "instrumentos": [
    { "id": "PHQ-9|GAD-7|BDI-II|BAI|PCL-5", "justificativa": "..." }
  ]
}

Regras:
- 2 a 4 temas descritivos. Use linguagem observacional ("aparecem juntos em N sessões", "co-ocorre com…", "tendência de redução").
- "titulo" curto (até 80 chars) factual. "descricao" 1-2 frases com números concretos. "trend" opcional, só se houver tendência clara.
- "positivo": true APENAS se a observação descreve melhora/redução de sintoma/abertura crescente.
- Sugira 1-2 instrumentos APENAS se o padrão de temas justifica claramente (ex: ansiedade frequente → GAD-7; humor baixo + sono + culpa → PHQ-9). NÃO sugira por padrão.
- NUNCA emita diagnóstico, hipótese clínica ou recomendação terapêutica. Apenas observe frequências e sugira rastreio.
- Português brasileiro.`

async function gerarObservacoes(opts: {
  pacienteNome: string
  totalSessoes: number
  grafo: { nodes: { palavra: string; cluster: string; frequencia: number }[]; edges: { a: string; b: string; weight: number }[] }
}): Promise<{ temas: TemaDescritivo[]; instrumentos: Instrumento[] }> {
  const top = opts.grafo.nodes.slice(0, 20).map(n => `${n.palavra} · ${n.cluster} · ${n.frequencia}x`).join('\n')
  const arestas = opts.grafo.edges.slice(0, 18).map(e => `${e.a} + ${e.b} (peso ${e.weight})`).join('\n')

  const userMsg = `Paciente: ${opts.pacienteNome}
Total de sessões assinadas: ${opts.totalSessoes}

Palavras (palavra · cluster · frequência):
${top || '(nenhuma)'}

Co-ocorrências (peso = co-aparecer):
${arestas || '(nenhuma)'}`

  const raw = await chat(SYS_OBS, [{ role: 'user', content: userMsg }], { scope: 'evolucao.obs', maxTokens: 900, model: 'strong' })

  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const json = m ? JSON.parse(m[0]) : {}
    const temas = (Array.isArray(json.temas) ? json.temas : []).slice(0, 4).map((t: any) => ({
      titulo: String(t.titulo ?? '').slice(0, 200),
      descricao: String(t.descricao ?? '').slice(0, 400),
      trend: t.trend ? String(t.trend).slice(0, 200) : undefined,
      positivo: !!t.positivo,
    }))
    const instrumentos = (Array.isArray(json.instrumentos) ? json.instrumentos : []).slice(0, 3).map((i: any) => ({
      id: i.id as Instrumento['id'],
      justificativa: String(i.justificativa ?? '').slice(0, 300),
    })).filter((i: any) => ['PHQ-9', 'GAD-7', 'BDI-II', 'BAI', 'PCL-5'].includes(i.id))
    return { temas, instrumentos }
  } catch {
    return { temas: [], instrumentos: [] }
  }
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}
