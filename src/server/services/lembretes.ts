import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Preferências de lembrete antes da sessão (24h, 2h, 15 min).
 *
 * Psicólogo: padrão (sempre booleano). Paciente: ajuste fino, onde `null`
 * significa "segue o padrão". Quem aplica é o cron (src/server/lib/cron.ts),
 * com COALESCE(paciente, psicólogo). Migration 052.
 */
export type TipoLembrete = 'lembrete24h' | 'lembrete2h' | 'lembrete15min'
export const TIPOS_LEMBRETE: TipoLembrete[] = ['lembrete24h', 'lembrete2h', 'lembrete15min']

export type LembretesPadrao = Record<TipoLembrete, boolean>
export type LembretesPaciente = Record<TipoLembrete, boolean | null>

const COLUNA: Record<TipoLembrete, string> = {
  lembrete24h: 'lembrete_24h',
  lembrete2h: 'lembrete_2h',
  lembrete15min: 'lembrete_15min',
}

export async function lerLembretesPadrao(psicologoId: string): Promise<LembretesPadrao | null> {
  const { rows } = await db.query<{ lembrete_24h: boolean; lembrete_2h: boolean; lembrete_15min: boolean }>(
    'SELECT lembrete_24h, lembrete_2h, lembrete_15min FROM psicologos WHERE id = $1',
    [psicologoId],
  )
  const r = rows[0]
  if (!r) return null
  return { lembrete24h: r.lembrete_24h, lembrete2h: r.lembrete_2h, lembrete15min: r.lembrete_15min }
}

export async function salvarLembretesPadrao(psicologoId: string, v: LembretesPadrao): Promise<void> {
  await db.query(
    `UPDATE psicologos SET lembrete_24h = $2, lembrete_2h = $3, lembrete_15min = $4 WHERE id = $1`,
    [psicologoId, !!v.lembrete24h, !!v.lembrete2h, !!v.lembrete15min],
  )
}

/** Lê o ajuste do paciente — só se ele for do psicólogo (posse conferida). */
export async function lerLembretesPaciente(
  psicologoId: string, pacienteId: string,
): Promise<LembretesPaciente | null> {
  const { rows } = await db.query<{ lembrete_24h: boolean | null; lembrete_2h: boolean | null; lembrete_15min: boolean | null }>(
    `SELECT lembrete_24h, lembrete_2h, lembrete_15min
       FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId],
  )
  const r = rows[0]
  if (!r) return null
  return { lembrete24h: r.lembrete_24h, lembrete2h: r.lembrete_2h, lembrete15min: r.lembrete_15min }
}

export async function salvarLembretesPaciente(
  psicologoId: string, pacienteId: string, v: LembretesPaciente,
): Promise<boolean> {
  const norm = (x: unknown) => (x === true || x === false ? x : null)
  const { rowCount } = await db.query(
    `UPDATE pacientes SET lembrete_24h = $3, lembrete_2h = $4, lembrete_15min = $5
      WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId, norm(v.lembrete24h), norm(v.lembrete2h), norm(v.lembrete15min)],
  )
  return (rowCount ?? 0) > 0
}

/** Fragmento SQL do valor efetivo (aliases `p` = pacientes, `ps` = psicologos). */
export function sqlLembreteAtivo(tipo: TipoLembrete): string {
  const c = COLUNA[tipo]
  return `COALESCE(p.${c}, ps.${c})`
}
