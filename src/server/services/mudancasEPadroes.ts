import 'server-only'
import { db } from '@/server/db/pool'
import { lerGrafo } from './temas'

/**
 * "O que mudou" + "Padrões identificados" (Fase 3 do redesign de Evolução).
 * DETERMINÍSTICO — sem IA. Mudanças = deltas dos indicadores + temas
 * emergindo/recuando. Padrões = co-ocorrência (arestas do grafo).
 * Observacional/co-ocorrência, nunca causal nem diagnóstico.
 */

export type MudancasPadroes = { mudancas: string[]; padroes: string[] }

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s

function tendencia(valores: number[], janela = 4): '↑' | '↓' | '→' {
  if (valores.length < 2) return '→'
  const n = valores.length
  const j = Math.min(janela, Math.max(1, Math.floor(n / 2)))
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const delta = avg(valores.slice(-j)) - avg(valores.slice(0, n - j))
  return Math.abs(delta) < 0.1 ? '→' : delta > 0 ? '↑' : '↓'
}

export async function mudancasEPadroes(
  pacienteId: string,
  perfil: { sparkHumor: number[]; sparkRitmo: number[]; presenca: number },
): Promise<MudancasPadroes> {
  const [grafo, sessRes] = await Promise.all([
    lerGrafo(pacienteId),
    db.query<{ id: string }>(`SELECT id FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE ORDER BY data_hora ASC`, [pacienteId]),
  ])
  const sessoes = sessRes.rows.map(r => r.id)
  const N = sessoes.length

  // ── O QUE MUDOU ──
  const mudancas: string[] = []
  if (perfil.presenca >= 80) mudancas.push('Presença manteve-se consistente.')
  const th = tendencia(perfil.sparkHumor)
  if (th === '↑') mudancas.push('Maior abertura emocional ao longo do processo.')
  else if (th === '↓') mudancas.push('Abertura emocional com leve redução recente.')
  if (tendencia(perfil.sparkRitmo) === '↑') mudancas.push('Aumento da participação do paciente nas sessões.')

  // Temas emergindo / recuando (janela recente × anterior)
  if (N >= 4) {
    const R = Math.min(4, Math.max(2, Math.ceil(N / 3)))
    for (const node of grafo.nodes) {
      const presente = sessoes.map(s => node.sessoesIds.includes(s))
      const recentes = presente.slice(N - R).filter(Boolean).length
      const anteriores = presente.slice(0, N - R).filter(Boolean).length
      if (recentes > 0 && anteriores === 0) mudancas.push(`Tema “${node.palavra}” emergiu nas sessões recentes.`)
      else if (recentes === 0 && anteriores > 0) mudancas.push(`Tema “${node.palavra}” menos frequente recentemente.`)
      if (mudancas.length >= 6) break
    }
  }

  // ── PADRÕES (co-ocorrência) ──
  const padroes = grafo.edges.slice(0, 4).map(e => `${cap(e.a)} aparece junto com ${e.b}`)

  return { mudancas: mudancas.slice(0, 6), padroes }
}
