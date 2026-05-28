import 'server-only'
import { randomBytes } from 'node:crypto'
import { db } from '@/server/db/pool'

export type SalaVideo = {
  id: string
  sessaoId: string
  token: string
  criadaEm: string
  ativaAte: string
  encerradaEm: string | null
}

function rowToSala(r: any): SalaVideo {
  return {
    id: r.id,
    sessaoId: r.sessao_id,
    token: r.token,
    criadaEm: r.criada_em,
    ativaAte: r.ativa_ate,
    encerradaEm: r.encerrada_em,
  }
}

/**
 * Cria (ou retorna a existente ativa) sala de vídeo para a sessão.
 * Sala é válida por 4h por padrão.
 */
export async function criarOuObterSala(sessaoId: string, validadeHoras = 4): Promise<SalaVideo> {
  // Já tem sala ativa?
  const { rows: exist } = await db.query(
    `SELECT * FROM salas_video
      WHERE sessao_id = $1 AND encerrada_em IS NULL AND ativa_ate > NOW()
      ORDER BY criada_em DESC LIMIT 1`,
    [sessaoId],
  )
  if (exist[0]) return rowToSala(exist[0])

  const token = randomBytes(16).toString('hex')
  const ativaAte = new Date(Date.now() + validadeHoras * 60 * 60 * 1000)
  const { rows } = await db.query(
    `INSERT INTO salas_video (sessao_id, token, ativa_ate)
     VALUES ($1, $2, $3) RETURNING *`,
    [sessaoId, token, ativaAte.toISOString()],
  )
  return rowToSala(rows[0])
}

export async function buscarSalaPorToken(token: string): Promise<SalaVideo | null> {
  const { rows } = await db.query(
    `SELECT * FROM salas_video WHERE token = $1 LIMIT 1`, [token],
  )
  return rows[0] ? rowToSala(rows[0]) : null
}

export async function encerrarSala(token: string): Promise<void> {
  await db.query(
    `UPDATE salas_video SET encerrada_em = NOW() WHERE token = $1`, [token],
  )
}
