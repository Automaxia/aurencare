import 'server-only'
import { db } from '@/server/db/pool'
import { hojeBrasiliaISO } from '@/lib/formatters'

/**
 * Marcos de progresso da Meta — anotações livres datadas. Disponíveis em qualquer
 * método de objetivo (SMART ou Simples/Livre), sem depender de métrica nem GAS.
 */

export type NotaProgresso = {
  id: string
  objetivoId: string
  texto: string
  marcoEm: string   // YYYY-MM-DD
  createdAt: string
}

function rowToNota(r: any): NotaProgresso {
  return {
    id: r.id, objetivoId: r.objetivo_id, texto: r.texto,
    marcoEm: new Date(r.marco_em).toISOString().slice(0, 10),
    createdAt: r.created_at,
  }
}

/** Notas de progresso de todas as Metas de um paciente, agrupadas por objetivo (mais recente primeiro). */
export async function listarNotasPorPaciente(pacienteId: string): Promise<Record<string, NotaProgresso[]>> {
  const { rows } = await db.query(
    `SELECT n.* FROM objetivo_notas n
       JOIN objetivos o ON o.id = n.objetivo_id
      WHERE o.paciente_id = $1
      ORDER BY n.marco_em DESC, n.created_at DESC`,
    [pacienteId],
  )
  const map: Record<string, NotaProgresso[]> = {}
  for (const r of rows) (map[r.objetivo_id] ??= []).push(rowToNota(r))
  return map
}

export async function criarNota(objetivoId: string, input: { texto: string; marcoEm?: string | null }): Promise<NotaProgresso> {
  const marcoEm = input.marcoEm || hojeBrasiliaISO()
  const { rows } = await db.query(
    `INSERT INTO objetivo_notas (objetivo_id, texto, marco_em) VALUES ($1, $2, $3) RETURNING *`,
    [objetivoId, input.texto.trim(), marcoEm],
  )
  return rowToNota(rows[0])
}

export async function removerNota(id: string): Promise<void> {
  await db.query('DELETE FROM objetivo_notas WHERE id = $1', [id])
}
