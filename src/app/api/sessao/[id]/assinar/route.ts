import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { encrypt } from '@/server/lib/crypto'
import { assinarSessao } from '@/server/services/sessoes'
import { validarTextoIA } from '@/server/lib/aiGuard'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requirePsicologo()
  const body = await req.json().catch(() => ({} as any))
  const resumoFinal = String(body?.resumoFinal ?? '').trim()
  const notaClinica = String(body?.notaClinica ?? '').trim()

  if (resumoFinal.length === 0) return NextResponse.json({ error: 'resumo_vazio' }, { status: 400 })
  if (!validarTextoIA(resumoFinal)) return NextResponse.json({ error: 'termos_proibidos' }, { status: 400 })

  await db.query(
    `UPDATE sessoes SET resumo_ia = $2, nota_clinica = $3 WHERE id = $1`,
    [params.id, encrypt(resumoFinal), notaClinica ? encrypt(notaClinica) : null],
  )
  await assinarSessao(params.id)

  return NextResponse.json({ ok: true })
}
