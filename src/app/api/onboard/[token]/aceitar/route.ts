import { NextResponse } from 'next/server'
import { db } from '@/server/db/pool'

const CONSENT_VERSION = 'lgpd-2026.05'

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { rows } = await db.query<{ id: string; aceito: boolean }>(
    'SELECT id, consentimento_aceito AS aceito FROM pacientes WHERE consentimento_token = $1 LIMIT 1',
    [params.token],
  )
  const paciente = rows[0]
  if (!paciente) return NextResponse.json({ error: 'token inválido' }, { status: 404 })
  if (paciente.aceito) return NextResponse.json({ ok: true })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE pacientes
         SET consentimento_aceito = TRUE,
             consentimento_timestamp = NOW()
       WHERE id = $1`,
      [paciente.id],
    )
    await client.query(
      `INSERT INTO consentimentos (paciente_id, texto_versao, ip, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [paciente.id, CONSENT_VERSION, ip, ua],
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: 'falha ao registrar' }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}
