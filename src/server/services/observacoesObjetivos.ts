import 'server-only'
import { db } from '@/server/db/pool'
import { lerGrafo } from './temas'
import { listarObjetivos } from './objetivos'

/**
 * Observações da Audere por objetivo (Fase 3 do redesign). DETERMINÍSTICO —
 * sem IA. Uma observação curta e observacional por objetivo ATIVO, priorizando
 * a mais acionável. Nunca diagnóstica.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const DIAS = 86_400_000

export async function observacoesObjetivos(pacienteId: string): Promise<Record<string, string>> {
  const [objs, sessRes, grafo, medRes] = await Promise.all([
    listarObjetivos(pacienteId),
    db.query<{ id: string }>(`SELECT id FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE ORDER BY data_hora ASC`, [pacienteId]),
    lerGrafo(pacienteId),
    db.query<{ objetivo_id: string; medido_em: string; valor: string }>(
      `SELECT m.objetivo_id, m.medido_em, m.valor
         FROM objetivo_medicoes m JOIN objetivos o ON o.id = m.objetivo_id
        WHERE o.paciente_id = $1 ORDER BY m.medido_em ASC`, [pacienteId]),
  ])

  const sessoes = sessRes.rows.map(r => r.id)
  const N = sessoes.length
  const K = Math.min(5, N)   // janela "últimas sessões" pra temas

  const medPorObj: Record<string, { data: string; valor: number }[]> = {}
  for (const r of medRes.rows) (medPorObj[r.objetivo_id] ??= []).push({ data: r.medido_em, valor: parseFloat(r.valor) })

  const out: Record<string, string> = {}

  for (const o of objs) {
    if (o.status !== 'ativo') continue
    const meds = medPorObj[o.id] ?? []

    // 1) Abandono — sem nova medição há ≥21 dias.
    if (meds.length > 0) {
      const dias = Math.floor((Date.now() - +new Date(meds[meds.length - 1].data)) / DIAS)
      if (dias >= 21) { out[o.id] = `Sem nova medição há ${dias} dias.`; continue }
    }

    // Tema associado ao objetivo (match por palavra do título).
    const palavrasTitulo = new Set(norm(o.titulo).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean))
    const node = grafo.nodes.find(n => palavrasTitulo.has(norm(n.palavra)))
    if (node && N >= 4) {
      const presente = sessoes.map(s => node.sessoesIds.includes(s))
      const recentes = presente.slice(N - K).filter(Boolean).length
      let streak = 0; for (let i = N - 1; i >= 0 && presente[i]; i--) streak++

      // 2) O tema do objetivo sumiu das últimas sessões.
      if (recentes === 0 && presente.some(Boolean)) { out[o.id] = `O tema “${node.palavra}” não apareceu nas últimas ${K} sessões.`; continue }
      // 3) O tema está em foco (sessões seguidas).
      if (streak >= 3) { out[o.id] = `Tema “${node.palavra}” mencionado em ${streak} sessões seguidas.`; continue }
    }

    // 4) Platô — últimas medições sem variação.
    if (meds.length >= 3) {
      const ult3 = meds.slice(-3).map(m => m.valor)
      if (Math.max(...ult3) - Math.min(...ult3) === 0) { out[o.id] = 'Progresso estável desde a última revisão.'; continue }
    }

    // 5) Setup — objetivo ativo há dias, ainda sem medição.
    if (meds.length === 0) {
      const dias = Math.floor((Date.now() - +new Date(o.createdAt)) / DIAS)
      if (dias >= 7) { out[o.id] = 'Ainda sem medições — registre pra acompanhar a tendência.'; continue }
    }
  }

  return out
}
