import 'server-only'
import cron from 'node-cron'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from './evolution'
import { enviarEmailPacientePorSessao } from './emailPaciente'
import { tplLembrete24h, tplLembrete15min } from './emailTemplates'
import { criarOuObterSala } from '@/server/services/salaVideo'
import { liberarSilenciosos } from '@/server/services/confirmacaoSessao'
import { interromperSessao } from '@/server/services/sessoes'
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
  // A cada 5 min — libera confirmações pós-sessão sem resposta (silêncio = consentimento)
  cron.schedule('*/5 * * * *', () => { void liberarSilenciosos() }, { timezone: 'America/Sao_Paulo' })
  // A cada 30 min (7–21h) — pergunta método de pagamento das séries (Fluxo 2, ~48h antes)
  cron.schedule('*/30 7-21 * * *', () => { void perguntarMetodoPendentes() }, { timezone: 'America/Sao_Paulo' })
  // A cada 15 min — destrava sessões esquecidas em 'em_curso' (aba fechada/queda)
  cron.schedule('*/15 * * * *', () => { void destravarSessoesEmCurso() }, { timezone: 'America/Sao_Paulo' })

  log.ok('cron', 'agendamentos registrados (24h@18h · 2h@30min · 15min@5min · liberar@5min · perguntar-metodo@30min · destravar@15min)')
}

/** Horas em 'em_curso' após as quais a sessão é considerada abandonada. */
const HORAS_ATE_DESTRAVAR = 6

/**
 * Cron: sessão que ficou presa em 'em_curso'. `iniciarSessao` marca o status,
 * mas só `encerrarSessao` o tirava de lá — se a aba fecha, cai a conexão ou o
 * pod reinicia no meio, a sessão fica "● ao vivo" na agenda e com o pill
 * pulsando na topbar pra sempre, sem botão nenhum que a resolva.
 *
 * Duas saídas, conforme o que existir de registro:
 *  - COM registro clínico (transcrição/nota/resumo/assinatura): vira 'concluida'.
 *    Houve sessão e há prontuário — concluir é o que é verdade; apagar, não.
 *  - SEM registro: `interromperSessao` devolve pra fila (remarcável), estorna a
 *    cota de IA e não dispara nada ao paciente.
 *
 * Janela de 6h: mais longo que qualquer sessão real (50min) com folga pra
 * intervalo/pausa, então não corta ninguém em atendimento.
 */
export async function destravarSessoesEmCurso(): Promise<{ concluidas: number; interrompidas: number }> {
  const { rows } = await db.query<{ id: string; psicologo_id: string; tem_registro: boolean }>(
    `SELECT id, psicologo_id,
            (assinada
             OR transcricao_texto IS NOT NULL
             OR nota_clinica     IS NOT NULL
             OR resumo_ia        IS NOT NULL
             OR resumo_curto     IS NOT NULL) AS tem_registro
       FROM sessoes
      WHERE status = 'em_curso'
        AND COALESCE(iniciada_em, data_hora) < NOW() - make_interval(hours => $1::int)
      ORDER BY COALESCE(iniciada_em, data_hora) ASC
      LIMIT 100`,
    [HORAS_ATE_DESTRAVAR],
  )

  let concluidas = 0, interrompidas = 0
  for (const r of rows) {
    try {
      if (r.tem_registro) {
        // Não passa por encerrarSessao: aquele caminho gera resumo e dispara
        // WhatsApp pós-sessão. Aqui é só corrigir o status pendurado.
        await db.query(`UPDATE sessoes SET status = 'concluida' WHERE id = $1 AND status = 'em_curso'`, [r.id])
        concluidas++
      } else {
        const res = await interromperSessao(r.psicologo_id, r.id, 'cron')
        if (res.ok) interrompidas++
      }
    } catch (err) {
      log.err('cron.destravar', `falha sessao=${r.id}`, err)
    }
  }
  if (concluidas || interrompidas) {
    log.ok('cron.destravar', `${concluidas} concluída(s) · ${interrompidas} interrompida(s)`)
  }
  return { concluidas, interrompidas }
}

/**
 * Cron: pra cada sessão de série em `aguardando_metodo` cujo wa_pergunta_metodo_em
 * é NULL e está em [agora, agora+50h], dispara Fluxo 2 e grava o timestamp.
 * Fonte única — a rota /api/cron/perguntar-metodo também chama esta função.
 */
export async function perguntarMetodoPendentes(): Promise<{ enviadas: number; total: number }> {
  const { rows } = await db.query<{ id: string; data_hora: string; valor: string; telefone: string }>(
    `SELECT s.id, s.data_hora, s.valor, p.telefone
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.serie_id IS NOT NULL
        AND s.status = 'aguardando_metodo'
        AND s.wa_pergunta_metodo_em IS NULL
        AND s.data_hora >= NOW()
        AND s.data_hora <= NOW() + INTERVAL '50 hours'
      ORDER BY s.data_hora ASC
      LIMIT 50`,
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
  if (enviadas) log.ok('cron.perguntar', `${enviadas} pergunta(s) de método enviada(s)`)
  return { enviadas, total: rows.length }
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
