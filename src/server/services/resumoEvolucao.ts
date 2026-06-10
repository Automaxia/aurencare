import 'server-only'
import { db } from '@/server/db/pool'
import { lerGrafo } from './temas'

/**
 * Resumo da Evolução (Fase 1 do redesign de Evolução Registrada).
 * DETERMINÍSTICO — sem IA. Síntese observacional do processo a partir de fatos:
 * volume de sessões assinadas, continuidade (intervalos), objetivos sem medição,
 * volume de temas. Linguagem observacional, nunca diagnóstica.
 */

export type ResumoEvolucaoDados = { frases: string[]; suficiente: boolean }

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s
const DIAS = 86_400_000

export async function resumoEvolucao(pacienteId: string): Promise<ResumoEvolucaoDados> {
  const [sessRes, objRes, grafo] = await Promise.all([
    db.query<{ data_hora: string }>(
      `SELECT data_hora FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE ORDER BY data_hora ASC`, [pacienteId]),
    db.query<{ titulo: string; meds: number }>(
      `SELECT o.titulo, (SELECT count(*)::int FROM objetivo_medicoes m WHERE m.objetivo_id = o.id) AS meds
         FROM objetivos o WHERE o.paciente_id = $1 AND o.status = 'ativo' ORDER BY o.created_at ASC`, [pacienteId]),
    lerGrafo(pacienteId),
  ])

  const datas = sessRes.rows.map(r => +new Date(r.data_hora))
  const N = datas.length

  // Estado insuficiente — explicativo (ensina o funcionamento).
  if (N < 2) {
    return {
      suficiente: false,
      frases: [
        N === 0
          ? 'Ainda não há sessões assinadas para análise longitudinal.'
          : 'Há apenas uma sessão assinada — ainda sem histórico para comparar.',
        'Conforme você assina novas sessões, a Audere passa a identificar padrões recorrentes, mudanças ao longo do tempo, associações entre temas e marcos terapêuticos.',
      ],
    }
  }

  const frases: string[] = []
  frases.push(`Em acompanhamento, com ${N} sessões assinadas.`)

  // Continuidade — maior intervalo entre sessões consecutivas.
  let maxGapDias = 0
  for (let i = 1; i < N; i++) maxGapDias = Math.max(maxGapDias, Math.round((datas[i] - datas[i - 1]) / DIAS))
  if (maxGapDias > 35) frases.push(`Houve um intervalo maior entre sessões (até ${maxGapDias} dias) — vale observar a continuidade.`)
  else frases.push('Não foram observadas rupturas relevantes na continuidade.')

  // Objetivo ativo sem medição.
  const semMedicao = objRes.rows.find(o => o.meds === 0)
  if (semMedicao) frases.push(`O objetivo “${cap(semMedicao.titulo)}” segue ativo, sem medição registrada desde a criação.`)

  // Volume de temas.
  if (grafo.nodes.length < 4) frases.push('Ainda há poucos temas assinados para uma análise longitudinal aprofundada.')
  else frases.push(`${grafo.nodes.length} temas recorrentes já permitem leitura de continuidade.`)

  return { frases, suficiente: true }
}
