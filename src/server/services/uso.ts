import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Uso mensal de sessões-IA (Modo Presença) por psicólogo. §Pricing/gate.
 * Competência = mês de referência no fuso America/São_Paulo ('YYYY-MM').
 */

/** Mês de referência atual ('YYYY-MM') no fuso de Brasília. */
export function competenciaAtual(): string {
  // en-CA formata como YYYY-MM-DD; pegamos só ano-mês no fuso correto.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return ymd.slice(0, 7)
}

/** Quantas sessões-IA o psicólogo consumiu na competência (default: mês atual). */
export async function contarSessoesIaMes(
  psicologoId: string, competencia = competenciaAtual(),
): Promise<number> {
  const { rows } = await db.query<{ sessoes_ia: number }>(
    `SELECT sessoes_ia FROM uso_mensal WHERE psicologo_id = $1 AND competencia = $2`,
    [psicologoId, competencia],
  )
  return rows[0]?.sessoes_ia ?? 0
}

/**
 * Incrementa o contador de sessões-IA do mês (upsert atômico) e devolve o
 * total já incluindo este incremento. Usado pelo gate ao iniciar Modo Presença.
 */
export async function incrementarSessaoIa(
  psicologoId: string, competencia = competenciaAtual(),
): Promise<number> {
  const { rows } = await db.query<{ sessoes_ia: number }>(
    `INSERT INTO uso_mensal (psicologo_id, competencia, sessoes_ia)
       VALUES ($1, $2, 1)
     ON CONFLICT (psicologo_id, competencia)
       DO UPDATE SET sessoes_ia = uso_mensal.sessoes_ia + 1, updated_at = NOW()
     RETURNING sessoes_ia`,
    [psicologoId, competencia],
  )
  return rows[0]?.sessoes_ia ?? 1
}

/**
 * Estorna 1 sessão-IA do mês — usado quando a sessão é INTERROMPIDA (não virou
 * registro clínico): a psicóloga não deve pagar cota por uma sessão que não
 * aconteceu. Só quem já fez a transição `ia_contabilizada TRUE→FALSE` chama
 * aqui, então não há estorno duplo.
 *
 * GREATEST(...,0) trava o contador em zero: se a sessão foi contabilizada num
 * mês e interrompida no seguinte, o estorno cai na competência atual (não
 * guardamos a de origem) e no pior caso vira no-op — nunca um saldo negativo.
 */
export async function decrementarSessaoIa(
  psicologoId: string, competencia = competenciaAtual(),
): Promise<number> {
  const { rows } = await db.query<{ sessoes_ia: number }>(
    `UPDATE uso_mensal
        SET sessoes_ia = GREATEST(sessoes_ia - 1, 0), updated_at = NOW()
      WHERE psicologo_id = $1 AND competencia = $2
      RETURNING sessoes_ia`,
    [psicologoId, competencia],
  )
  return rows[0]?.sessoes_ia ?? 0
}
