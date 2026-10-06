import 'server-only'
import { NextResponse } from 'next/server'
import { checarCotaIaSessao } from '@/server/services/sessoes'

/**
 * Atalho pras rotas: devolve a resposta 403 pronta quando a cota de IA da sessão
 * estourou, ou null pra seguir. Ver `checarCotaIaSessao`.
 */
export async function bloqueioCotaIa(
  psicologoId: string, sessaoId: string, modo: 'consumir' | 'verificar' = 'consumir',
): Promise<NextResponse | null> {
  const r = await checarCotaIaSessao(psicologoId, sessaoId, modo)
  if (r.ok) return null
  if (r.motivo === 'nao_encontrada') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(
    { ok: false, error: 'limite_plano', motivo: r.motivo, cap: r.cap, usadas: r.usadas, plano: r.plano },
    { status: 403 },
  )
}
