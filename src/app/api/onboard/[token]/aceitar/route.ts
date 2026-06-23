import { NextResponse } from 'next/server'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'

const CONSENT_VERSION = 'lgpd-2026.05'

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { rows } = await db.query<{ id: string; aceito: boolean }>(
    'SELECT id, consentimento_aceito AS aceito FROM pacientes WHERE consentimento_token = $1 LIMIT 1',
    [params.token],
  )
  const paciente = rows[0]
  if (!paciente) return NextResponse.json({ error: 'token inválido' }, { status: 404 })
  if (paciente.aceito) return NextResponse.json({ ok: true })

  // 1) Marca o consentimento — fonte legal da prova (timestamp em pacientes).
  //    É o passo crítico; só aqui um erro justifica bloquear o paciente.
  try {
    await db.query(
      `UPDATE pacientes SET consentimento_aceito = TRUE, consentimento_timestamp = NOW() WHERE id = $1`,
      [paciente.id],
    )
  } catch (e) {
    log.err('onboard.aceitar', 'falha ao marcar consentimento', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'falha ao registrar' }, { status: 500 })
  }

  // 2) Auditoria detalhada (versão/IP/UA) — best-effort, NÃO bloqueia o paciente.
  //    Trunca p/ caber nas colunas (ip VARCHAR(64), user_agent VARCHAR(255)).
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null)?.slice(0, 64) ?? null
    const ua = (req.headers.get('user-agent') ?? null)?.slice(0, 255) ?? null
    await db.query(
      `INSERT INTO consentimentos (paciente_id, texto_versao, ip, user_agent) VALUES ($1, $2, $3, $4)`,
      [paciente.id, CONSENT_VERSION, ip, ua],
    )
  } catch (e) {
    log.err('onboard.aceitar', 'falha na auditoria de consentimento (não bloqueante)', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true })
}
