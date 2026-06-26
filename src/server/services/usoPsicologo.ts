import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

/**
 * Observabilidade de uso dos psicólogos. Tracking NUNCA pode quebrar o login
 * ou a navegação — todas as funções engolem o próprio erro.
 */

/** Login bem-sucedido: grava 1 evento + atualiza os contadores do psicólogo. */
export async function registrarLogin(psicologoId: string, ip: string | null, userAgent: string | null): Promise<void> {
  try {
    await db.query(
      `INSERT INTO login_eventos (psicologo_id, ip, user_agent) VALUES ($1, $2, $3)`,
      [psicologoId, ip, userAgent],
    )
    await db.query(
      `UPDATE psicologos
          SET login_count = COALESCE(login_count, 0) + 1,
              ultimo_login_em = NOW(),
              ultimo_acesso_em = NOW()
        WHERE id = $1`,
      [psicologoId],
    )
  } catch (err) {
    log.err('uso', 'falha ao registrar login', err)
  }
}

/**
 * "Visto por último" — atualiza ultimo_acesso_em no máximo a cada 5min (throttle
 * no próprio WHERE). Chamado a cada navegação no (app)/layout.
 */
export async function tocarAcesso(psicologoId: string): Promise<void> {
  try {
    await db.query(
      `UPDATE psicologos SET ultimo_acesso_em = NOW()
        WHERE id = $1
          AND (ultimo_acesso_em IS NULL OR ultimo_acesso_em < NOW() - INTERVAL '5 minutes')`,
      [psicologoId],
    )
  } catch (err) {
    log.err('uso', 'falha ao tocar acesso', err)
  }
}

export type LoginEvento = { em: string; ip: string | null; userAgent: string | null }

/** Histórico recente de logins (pro detalhe expansível no admin). */
export async function historicoLogins(psicologoId: string, limite = 20): Promise<LoginEvento[]> {
  const { rows } = await db.query<{ em: string; ip: string | null; user_agent: string | null }>(
    `SELECT em, ip, user_agent FROM login_eventos
      WHERE psicologo_id = $1 ORDER BY em DESC LIMIT $2`,
    [psicologoId, limite],
  )
  return rows.map(r => ({ em: r.em, ip: r.ip, userAgent: r.user_agent }))
}
