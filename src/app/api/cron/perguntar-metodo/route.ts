import { NextResponse } from 'next/server'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { formatDateTimeBR } from '@/lib/formatters'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron: pra cada sessão de série em `aguardando_metodo` cujo wa_pergunta_metodo_em
 * ainda é NULL e está entre [agora, agora+50h], dispara Fluxo 2 e grava timestamp.
 *
 * Janela 50h em vez de 48h pra absorver atraso do scheduler (rodando a cada 30min).
 * Auth: mesmo CRON_SECRET de /api/cron/liberar-confirmacoes.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const headerAuth = req.headers.get('authorization')
    const tokenHeader = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null
    const tokenQuery = url.searchParams.get('key')
    if (tokenHeader !== secret && tokenQuery !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const { rows } = await db.query<{
      id: string; data_hora: string; valor: string; telefone: string;
    }>(
      `SELECT s.id, s.data_hora, s.valor, p.telefone
         FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
        WHERE s.serie_id IS NOT NULL
          AND s.status = 'aguardando_metodo'
          AND s.wa_pergunta_metodo_em IS NULL
          AND s.data_hora >= NOW()
          AND s.data_hora <= NOW() + INTERVAL '50 hours'
        ORDER BY s.data_hora ASC
        LIMIT 50`,
      [],
    )

    let enviadas = 0
    for (const r of rows) {
      try {
        await enviarWA(
          r.telefone,
          WA_TEMPLATES.fluxo2_perguntarMetodo(formatDateTimeBR(r.data_hora), parseFloat(r.valor)),
        )
        await db.query(`UPDATE sessoes SET wa_pergunta_metodo_em = NOW() WHERE id = $1`, [r.id])
        enviadas++
      } catch (err) {
        log.err('cron.perguntar', `falha sessao=${r.id}`, err)
      }
    }

    return NextResponse.json({ ok: true, enviadas, total: rows.length })
  } catch (err) {
    log.err('cron.perguntar', 'falha', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
