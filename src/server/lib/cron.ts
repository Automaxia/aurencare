import 'server-only'
import cron from 'node-cron'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from './evolution'
import { log } from './log'
import { formatDateTimeBR } from '@/lib/formatters'

/**
 * Singleton de cron que carrega na primeira chamada e roda em-process.
 * Para produção, mover para worker separado (BullMQ + Redis).
 * §10 Fluxo 3.
 */

const globalAny = globalThis as unknown as { __aurenCronStarted?: boolean }

export function startCron() {
  if (globalAny.__aurenCronStarted) return
  globalAny.__aurenCronStarted = true

  // 18h00 todo dia — lembrete 24h
  cron.schedule('0 18 * * *', () => { void lembrete24h() }, { timezone: 'America/Sao_Paulo' })
  // A cada 30 min entre 7h e 21h — lembrete "2h antes"
  cron.schedule('*/30 7-21 * * *', () => { void lembrete2h() }, { timezone: 'America/Sao_Paulo' })

  log.ok('cron', 'agendamentos registrados (lembrete 24h@18h00 · lembrete 2h a cada 30min)')
}

export async function lembrete24h(): Promise<number> {
  const { rows } = await db.query(
    `UPDATE sessoes s
        SET wa_lembrete_24h = TRUE
       FROM pacientes p
      WHERE s.paciente_id = p.id
        AND s.data_hora BETWEEN NOW() + INTERVAL '20 hours' AND NOW() + INTERVAL '28 hours'
        AND s.status IN ('confirmada','agendada')
        AND s.wa_lembrete_24h = FALSE
     RETURNING s.id, s.data_hora, p.telefone`,
  )
  for (const r of rows) {
    await enviarWA(r.telefone, WA_TEMPLATES.fluxo3_lembrete24h(formatDateTimeBR(r.data_hora)))
  }
  if (rows.length) log.ok('cron.lembrete24h', `${rows.length} mensagem(ns) enviada(s)`)
  return rows.length
}

export async function lembrete2h(): Promise<number> {
  const { rows } = await db.query(
    `UPDATE sessoes s
        SET wa_lembrete_2h = TRUE
       FROM pacientes p
      WHERE s.paciente_id = p.id
        AND s.data_hora BETWEEN NOW() + INTERVAL '90 minutes' AND NOW() + INTERVAL '150 minutes'
        AND s.status IN ('confirmada','agendada')
        AND s.wa_lembrete_2h = FALSE
     RETURNING s.id, s.data_hora, p.telefone`,
  )
  for (const r of rows) {
    await enviarWA(r.telefone, WA_TEMPLATES.fluxo3_lembrete2h(formatDateTimeBR(r.data_hora)))
  }
  if (rows.length) log.ok('cron.lembrete2h', `${rows.length} mensagem(ns) enviada(s)`)
  return rows.length
}
