import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { encrypt, tryDecrypt } from '@/server/lib/crypto'
import { assinarSessao, buscarSessao } from '@/server/services/sessoes'
import { validarTextoIA } from '@/server/lib/aiGuard'
import { extrairTemasDaSessao } from '@/server/services/temas'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const resumoFinal = String(body?.resumoFinal ?? '').trim()
  const notaClinica = String(body?.notaClinica ?? '').trim()

  if (resumoFinal.length === 0) return NextResponse.json({ error: 'resumo_vazio' }, { status: 400 })
  if (!validarTextoIA(resumoFinal)) return NextResponse.json({ error: 'termos_proibidos' }, { status: 400 })

  // WHERE inclui psicologo_id — sem isso qualquer psicólogo logado assinaria/
  // sobrescreveria sessão de outro (IDOR). rowCount 0 = não é dono / não existe.
  const { rowCount } = await db.query(
    `UPDATE sessoes SET resumo_ia = $2, nota_clinica = $3 WHERE id = $1 AND psicologo_id = $4`,
    [params.id, encrypt(resumoFinal), notaClinica ? encrypt(notaClinica) : null, user.id],
  )
  if (!rowCount) return NextResponse.json({ error: 'nao_encontrada' }, { status: 404 })
  await assinarSessao(params.id)

  // Extrai temas para alimentar o grafo (Fase C).
  const sessao = await buscarSessao(params.id)
  if (sessao) {
    const { rows } = await db.query<{ transcricao_texto: string | null }>(
      `SELECT transcricao_texto FROM sessoes WHERE id = $1`, [params.id],
    )
    const tx = tryDecrypt(rows[0]?.transcricao_texto) ?? resumoFinal
    try {
      await extrairTemasDaSessao({ pacienteId: sessao.pacienteId, sessaoId: sessao.id, transcricao: tx })
    } catch (err) {
      log.warn('temas.extrair', 'falha ao extrair temas — assinatura mantida', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ ok: true })
}
