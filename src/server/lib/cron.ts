import 'server-only'
import cron from 'node-cron'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from './evolution'
import { enviarEmailPacientePorSessao } from './emailPaciente'
import { tplLembrete24h, tplLembrete15min } from './emailTemplates'
import { criarOuObterSala } from '@/server/services/salaVideo'
import { env } from './env'
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
  // A cada 5 min — lembrete "15 min antes" com link da sala (WhatsApp + email)
  cron.schedule('*/5 * * * *', () => { void lembrete15min() }, { timezone: 'America/Sao_Paulo' })

  log.ok('cron', 'agendamentos registrados (24h@18h · 2h a cada 30min · 15min a cada 5min)')
}

export async function lembrete15min(): Promise<number> {
  // Janela 12–18 min (maior que o intervalo de 5 min → cobre toda sessão; flag dedupe).
  const { rows } = await db.query<{
    id: string; data_hora: string; modalidade: string;
    pac_nome: string; pac_telefone: string; psi_nome: string; psi_email: string;
  }>(
    `UPDATE sessoes s
        SET wa_lembrete_15min = TRUE
       FROM pacientes p, psicologos ps
      WHERE s.paciente_id = p.id AND s.psicologo_id = ps.id
        AND s.data_hora BETWEEN NOW() + INTERVAL '12 minutes' AND NOW() + INTERVAL '18 minutes'
        AND s.status IN ('confirmada','agendada')
        AND s.wa_lembrete_15min = FALSE
     RETURNING s.id, s.data_hora, s.modalidade,
               p.nome AS pac_nome, p.telefone AS pac_telefone,
               ps.nome AS psi_nome, ps.email AS psi_email`,
  )
  for (const r of rows) {
    const dataFmt = formatDateTimeBR(r.data_hora)
    let linkSala: string | null = null
    if (r.modalidade === 'online') {
      try {
        const sala = await criarOuObterSala(r.id, 4)
        linkSala = `${env.appUrl.replace(/\/$/, '')}/sala/${sala.token}`
      } catch (err) { log.err('cron.lembrete15min', 'falha ao criar sala', err) }
    }
    await Promise.all([
      enviarWA(r.pac_telefone, WA_TEMPLATES.fluxo3_lembrete15min(dataFmt, linkSala))
        .catch(err => log.err('cron.lembrete15min', 'falha WA', err)),
      enviarEmailPacientePorSessao(
        r.id,
        tplLembrete15min({
          nomePaciente: r.pac_nome, psicologoNome: r.psi_nome, psicologoEmail: r.psi_email,
          dataHora: dataFmt, modalidade: r.modalidade, linkSala,
        }),
        'cron.lembrete15min',
      ),
    ])
  }
  if (rows.length) log.ok('cron.lembrete15min', `${rows.length} lembrete(s) de 15min enviado(s)`)
  return rows.length
}

export async function lembrete24h(): Promise<number> {
  const { rows } = await db.query<{
    id: string; data_hora: string; modalidade: string;
    pac_nome: string; pac_telefone: string;
    psi_nome: string; psi_email: string;
  }>(
    `UPDATE sessoes s
        SET wa_lembrete_24h = TRUE
       FROM pacientes p, psicologos ps
      WHERE s.paciente_id = p.id AND s.psicologo_id = ps.id
        AND s.data_hora BETWEEN NOW() + INTERVAL '20 hours' AND NOW() + INTERVAL '28 hours'
        AND s.status IN ('confirmada','agendada')
        AND s.wa_lembrete_24h = FALSE
     RETURNING s.id, s.data_hora, s.modalidade,
               p.nome AS pac_nome, p.telefone AS pac_telefone,
               ps.nome AS psi_nome, ps.email AS psi_email`,
  )
  for (const r of rows) {
    const dataFmt = formatDateTimeBR(r.data_hora)
    await Promise.all([
      enviarWA(r.pac_telefone, WA_TEMPLATES.fluxo3_lembrete24h(dataFmt))
        .catch(err => log.err('cron.lembrete24h', 'falha WA', err)),
      enviarEmailPacientePorSessao(
        r.id,
        tplLembrete24h({
          nomePaciente: r.pac_nome,
          psicologoNome: r.psi_nome,
          psicologoEmail: r.psi_email,
          dataHora: dataFmt,
          modalidade: r.modalidade,
        }),
        'cron.lembrete24h',
      ),
    ])
  }
  if (rows.length) log.ok('cron.lembrete24h', `${rows.length} lembrete(s) enviado(s)`)
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
