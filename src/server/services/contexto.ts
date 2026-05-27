import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'

export type UltimaSessao = {
  id: string
  numero: number
  dataHora: string
  bullets: string[]
}

export type Condicoes = {
  cid?: string[]
  medicacoes?: { nome: string; dose?: string }[]
  alertas?: string[]
  observacoes?: string
}

export async function ultimaSessaoAssinada(pacienteId: string, excetoId?: string): Promise<UltimaSessao | null> {
  const params: any[] = [pacienteId]
  let q = `SELECT id, numero, data_hora, resumo_ia
             FROM sessoes
            WHERE paciente_id = $1 AND assinada = TRUE`
  if (excetoId) { q += ` AND id <> $2`; params.push(excetoId) }
  q += ` ORDER BY data_hora DESC LIMIT 1`

  const { rows } = await db.query<{ id: string; numero: number; data_hora: string; resumo_ia: string | null }>(q, params)
  const s = rows[0]
  if (!s) return null
  const resumo = tryDecrypt(s.resumo_ia) ?? ''
  return {
    id: s.id, numero: s.numero, dataHora: s.data_hora,
    bullets: extractBullets(resumo),
  }
}

function extractBullets(text: string): string[] {
  if (!text) return []
  // Quebra por sentença, mantém as 4-5 mais informativas.
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 220)
    .slice(0, 5)
}

export async function ultimasSessoesAssinadas(pacienteId: string, n = 3): Promise<Array<{ numero: number; dataHora: string; resumo: string }>> {
  const { rows } = await db.query<{ numero: number; data_hora: string; resumo_ia: string | null }>(
    `SELECT numero, data_hora, resumo_ia FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora DESC LIMIT $2`,
    [pacienteId, n],
  )
  return rows.map(r => ({ numero: r.numero, dataHora: r.data_hora, resumo: tryDecrypt(r.resumo_ia) ?? '' }))
}

export async function lerCondicoesPaciente(pacienteId: string): Promise<Condicoes | null> {
  const { rows } = await db.query<{ condicoes: Condicoes | null }>('SELECT condicoes FROM pacientes WHERE id = $1', [pacienteId])
  return rows[0]?.condicoes ?? null
}

export async function salvarCondicoesPaciente(pacienteId: string, cond: Condicoes): Promise<void> {
  await db.query('UPDATE pacientes SET condicoes = $2 WHERE id = $1', [pacienteId, cond])
}
