import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Retorna o ID do paciente "mais relevante" do psicólogo —
 * o de sessão mais recente (passada ou futura). Útil para
 * shortcuts no sidebar que precisam de um paciente default.
 */
export async function firstPacienteIdFor(psicologoId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT p.id
       FROM pacientes p
       LEFT JOIN sessoes s ON s.paciente_id = p.id
      WHERE p.psicologo_id = $1 AND p.status = 'ativo'
      GROUP BY p.id
      ORDER BY MAX(s.data_hora) DESC NULLS LAST, p.created_at DESC
      LIMIT 1`,
    [psicologoId],
  )
  return rows[0]?.id ?? null
}
