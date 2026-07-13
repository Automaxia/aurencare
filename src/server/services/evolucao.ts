import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { padroesLongitudinais, type PadroesLongitudinais } from './temas'
import { chat } from '@/server/lib/anthropic'
import { redis } from '@/server/lib/redis'
import { psicologoDoPaciente } from './pacientes'

/**
 * Dados agregados para Evolução Registrada (página).
 * Combina dados estatísticos + observações textuais geradas pela IA.
 */

/** Um ponto de sparkline = uma sessão assinada. Carrega valor + contexto
 * (nº da sessão e data) pra alimentar tooltips na UI. */
export type SparkPonto = {
  v: number       // valor do indicador na sessão
  n: number       // nº da sessão assinada (1-based, ordem cronológica)
  data: string    // ISO da sessão
}

export type PerfilEvolucao = {
  avatar: string                 // iniciais
  nome: string
  totalSessoes: number
  minutosMedia: number
  desde: string                  // data primeira sessão
  presenca: number               // 0-100 (% comparecimento)
  abertura: number               // 0-100 (avg humor.estado mapeado)
  sparkHumor: SparkPonto[]
  sparkRitmo: SparkPonto[]
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

  // Recorrência CONTADA do store (§7.4) — não inferida pelo LLM.
  const padroes = await padroesLongitudinais(pacienteId)
  let temas: TemaDescritivo[] = []
  let instrumentos: Instrumento[] = []
  if (padroes.nos.length > 0) {
    const ger = await gerarObservacoes({ pacienteId, pacienteNome, padroes })
    temas = ger.temas
    instrumentos = ger.instrumentos
  }
  if (r) await r.set(cacheKey, JSON.stringify({ temas, instrumentos }), { EX: 86400 })
  return { temas, instrumentos }
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

  // sparklines — humor e ritmo por sessão (cronológico). Cada ponto guarda
  // o nº da sessão (posição em sessoesA) e a data, pra tooltip na UI.
  const sparkHumor: SparkPonto[] = sessoesA
    .map((s, i) => ({ v: s.indicadores?.humor?.estado, n: i + 1, data: s.data_hora }))
    .filter((p): p is SparkPonto => typeof p.v === 'number')
  const sparkRitmo: SparkPonto[] = sessoesA
    .map((s, i) => ({ v: s.indicadores?.ritmo?.paciente, n: i + 1, data: s.data_hora }))
    .filter((p): p is SparkPonto => typeof p.v === 'number')

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

const SYS_OBS = `Você sintetiza a análise LONGITUDINAL de um paciente para a psicóloga: padrões que se repetem ao longo das sessões.

As contagens de recorrência ("em X de Y sessões") JÁ VÊM CALCULADAS no input — use-as EXATAMENTE, NUNCA invente nem estime números. Você rotula e sintetiza; a estrutura já contou.

Priorize: (1) ARESTAS que recorrem em sessões diferentes (padrão transversal mais forte); (2) núcleos recorrentes; (3) núcleos que somem e reaparecem (movimento).

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
- 2 a 4 temas. Cada um ancorado num padrão recorrente do input, com a contagem dada ("recorre em 4 das 7 sessões").
- Apresente como HIPÓTESE A INVESTIGAR, não achado afirmado ("padrão a observar", "vale checar se…") — nunca como conclusão.
- "titulo" curto (até 80 chars) factual. "descricao" 1-2 frases. "trend" opcional, só se houver movimento claro.
- "positivo": true APENAS se descreve melhora/redução de sintoma/abertura crescente.
- Sugira 1-2 instrumentos APENAS se o padrão justifica claramente (ex: ansiedade recorrente → GAD-7; humor baixo + sono + culpa → PHQ-9). NÃO sugira por padrão.
- NUNCA emita diagnóstico nem recomendação terapêutica. Português brasileiro.`

async function gerarObservacoes(opts: {
  pacienteId: string
  pacienteNome: string
  padroes: PadroesLongitudinais
}): Promise<{ temas: TemaDescritivo[]; instrumentos: Instrumento[] }> {
  const { totalSessoes, nos, arestas } = opts.padroes
  const emY = (n: number) => `em ${n} de ${totalSessoes} ${totalSessoes === 1 ? 'sessão' : 'sessões'}`
  // Arestas recorrentes primeiro (padrão transversal mais forte — §7.3).
  const arestasTxt = arestas.slice(0, 18)
    .map(e => `${e.a} ${e.relacao ? '—' + e.relacao + '→' : '—'} ${e.b} · ${emY(e.nSessoes)}${e.nSessoes >= 2 ? ' [RECORRE]' : ''}`)
    .join('\n')
  const nosTxt = nos.slice(0, 24)
    .map(n => `${n.nucleo} · ${n.cluster} · ${emY(n.nSessoes)}${n.reaparece ? ' [some e reaparece]' : ''}${n.construto ? ' — ' + n.construto : ''}`)
    .join('\n')

  const userMsg = `Paciente: ${opts.pacienteNome}
Total de sessões analisadas: ${totalSessoes}

ARESTAS (relação entre construtos — contagem já calculada):
${arestasTxt || '(nenhuma)'}

NÚCLEOS (construto · cluster · recorrência):
${nosTxt || '(nenhum)'}`

  const psicologoId = (await psicologoDoPaciente(opts.pacienteId)) ?? ''
  const raw = await chat(SYS_OBS, [{ role: 'user', content: userMsg }], { scope: 'evolucao.obs', maxTokens: 900, model: 'strong', psicologoId, pacienteId: opts.pacienteId })

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
