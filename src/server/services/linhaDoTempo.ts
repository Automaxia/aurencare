import 'server-only'
import { db } from '@/server/db/pool'
import { lerMarcos } from './marcos'

/**
 * Linha do Tempo Clínica (Fase 2 do redesign de Evolução). Compõe a narrativa do
 * processo a partir de 3 fontes, em ordem cronológica:
 *  - 1ª sessão assinada (início do acompanhamento)
 *  - marcos (lerMarcos — IA, cacheado): insight/avanço/mudança/observação
 *  - objetivos (criado / concluído)
 * Observacional. A chamada de IA fica atrás do endpoint lazy (não bloqueia SSR).
 */

export type TimelineTipo = 'inicio' | 'insight' | 'avanco' | 'mudanca' | 'observacao' | 'objetivo' | 'concluido'
export type TimelineEvento = {
  data: string
  tipo: TimelineTipo
  titulo: string
  descricao?: string
  sessao?: number
}

export async function linhaDoTempoClinica(pacienteId: string): Promise<TimelineEvento[]> {
  const [marcos, objRes, primeiraRes] = await Promise.all([
    lerMarcos(pacienteId),
    db.query<{ titulo: string; created_at: string; status: string; updated_at: string }>(
      `SELECT titulo, created_at, status, updated_at FROM objetivos WHERE paciente_id = $1`, [pacienteId]),
    db.query<{ data_hora: string; numero: number }>(
      `SELECT data_hora, numero FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE ORDER BY data_hora ASC LIMIT 1`, [pacienteId]),
  ])

  const eventos: TimelineEvento[] = []

  const primeira = primeiraRes.rows[0]
  if (primeira) eventos.push({ data: primeira.data_hora, tipo: 'inicio', titulo: 'Início do acompanhamento', sessao: primeira.numero })

  for (const m of marcos) {
    if (m.tipo === 'inicio') continue   // já temos o início real
    eventos.push({ data: m.data, tipo: m.tipo, titulo: m.titulo, descricao: m.descricao, sessao: m.numero || undefined })
  }

  for (const o of objRes.rows) {
    eventos.push({ data: o.created_at, tipo: 'objetivo', titulo: `Objetivo criado: ${o.titulo}` })
    if (o.status === 'concluido') eventos.push({ data: o.updated_at, tipo: 'concluido', titulo: `Objetivo concluído: ${o.titulo}` })
  }

  return eventos
    .filter(e => !Number.isNaN(+new Date(e.data)))
    .sort((a, b) => +new Date(a.data) - +new Date(b.data))
}
