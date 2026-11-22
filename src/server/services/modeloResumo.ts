import 'server-only'
import { db } from '@/server/db/pool'
import { MODELO_RESUMO_MAX, MODELO_RESUMO_MIN } from '@/lib/modeloResumo'
import { obterAssinatura } from './assinatura'

/** Plano em que o modelo personalizado vale. */
export const PLANO_MODELO_RESUMO = 'pro' as const

export async function lerModeloResumo(psicologoId: string): Promise<{ texto: string | null; atualizadoEm: string | null }> {
  const { rows } = await db.query<{ modelo_resumo: string | null; modelo_resumo_atualizado_em: Date | null }>(
    `SELECT modelo_resumo, modelo_resumo_atualizado_em FROM psicologos WHERE id = $1`, [psicologoId])
  const r = rows[0]
  return { texto: r?.modelo_resumo ?? null, atualizadoEm: r?.modelo_resumo_atualizado_em?.toISOString() ?? null }
}

export type SalvarModeloResult = { ok: true } | { ok: false; erro: string }

/** `texto` vazio/null = volta ao padrão da Audere. */
export async function salvarModeloResumo(psicologoId: string, texto: string | null): Promise<SalvarModeloResult> {
  const limpo = (texto ?? '').replace(/\r\n/g, '\n').trim()
  if (limpo) {
    const { plano } = await obterAssinatura(psicologoId)
    if (plano !== PLANO_MODELO_RESUMO) return { ok: false, erro: 'O modelo personalizado é um recurso do plano Pro.' }
    if (limpo.length < MODELO_RESUMO_MIN) return { ok: false, erro: `Descreva o modelo com pelo menos ${MODELO_RESUMO_MIN} caracteres.` }
    if (limpo.length > MODELO_RESUMO_MAX) return { ok: false, erro: `O modelo pode ter até ${MODELO_RESUMO_MAX} caracteres.` }
  }
  await db.query(
    `UPDATE psicologos SET modelo_resumo = $2, modelo_resumo_atualizado_em = NOW() WHERE id = $1`,
    [psicologoId, limpo || null])
  return { ok: true }
}

/**
 * Modelo que a geração do resumo deve usar AGORA: o texto salvo, se o plano
 * efetivo for Pro; senão null (padrão). Falha de leitura → null: na dúvida,
 * gera com o padrão em vez de derrubar o encerramento da sessão.
 */
export async function modeloResumoAtivo(psicologoId: string): Promise<string | null> {
  try {
    const { texto } = await lerModeloResumo(psicologoId)
    if (!texto) return null
    const { plano } = await obterAssinatura(psicologoId)
    return plano === PLANO_MODELO_RESUMO ? texto : null
  } catch {
    return null
  }
}
