import 'server-only'
import { randomBytes } from 'node:crypto'
import { db } from '@/server/db/pool'
import { env } from '@/server/lib/env'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { log } from '@/server/lib/log'

/**
 * Confirmação pós-sessão pelo paciente (proteção contra má-fé do psicólogo).
 *
 * Janela:
 * - Sessão diurna (encerrou entre 08:00 e 19:59): 2 horas
 * - Sessão noturna (encerrou entre 20:00 e 07:59): até 09:00 do dia útil
 *   seguinte (mensagens noturnas atrapalham o paciente).
 *
 * Silêncio = consentimento → libera. Resposta SIM = libera. NAO = congela
 * pra disputa humana, NÃO estorna automático.
 */

const JANELA_DIURNA_MS = 2 * 60 * 60 * 1000
const HORA_INICIO_DIURNO = 8
const HORA_FIM_DIURNO = 20   // exclusive — 20:00 já é noturno
const HORA_LIBERACAO_NOTURNA = 9

/**
 * Dado o momento de encerramento, devolve quando a janela expira.
 * Exportada pra testabilidade.
 */
export function calcularJanelaConfirmacao(encerradaEm: Date = new Date()): Date {
  const h = encerradaEm.getHours()
  const noturno = h >= HORA_FIM_DIURNO || h < HORA_INICIO_DIURNO
  if (!noturno) return new Date(encerradaEm.getTime() + JANELA_DIURNA_MS)

  // Noturno: libera às 9h do PRÓXIMO dia (se já passou da meia-noite, hoje).
  const liberacao = new Date(encerradaEm)
  if (h >= HORA_FIM_DIURNO) liberacao.setDate(liberacao.getDate() + 1)
  liberacao.setHours(HORA_LIBERACAO_NOTURNA, 0, 0, 0)
  return liberacao
}

/**
 * String humana da janela pra colocar na mensagem WhatsApp.
 */
function descreverJanela(expiraEm: Date, agora: Date = new Date()): string {
  const ms = +expiraEm - +agora
  const horas = ms / 3_600_000
  if (horas <= 2.2) return 'em até 2 horas'
  // noturno
  const amanha = expiraEm.getDate() !== agora.getDate()
  return amanha ? 'até amanhã às 9h' : 'até as 9h da manhã'
}

export type EnviarResult = { ok: true; token: string } | { ok: false; razao: string }

/**
 * Dispara WhatsApp de confirmação e agenda janela.
 * Chamada ao encerrar a sessão.
 */
export async function enviarConfirmacaoPosSessao(sessaoId: string): Promise<EnviarResult> {
  const { rows } = await db.query<{
    id: string; data_hora: string; numero: number;
    paciente_nome: string; paciente_telefone: string;
    psicologa_nome: string;
    confirmacao_enviada_em: string | null;
    valor: string | null; pagamento_status: string | null;
  }>(
    `SELECT s.id, s.data_hora, s.numero,
            p.nome AS paciente_nome, p.telefone AS paciente_telefone,
            ps.nome AS psicologa_nome,
            s.confirmacao_enviada_em, s.valor, s.pagamento_status
       FROM sessoes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN psicologos ps ON ps.id = s.psicologo_id
      WHERE s.id = $1 LIMIT 1`,
    [sessaoId],
  )
  const s = rows[0]
  if (!s) return { ok: false, razao: 'sessao_nao_encontrada' }
  // Idempotência: se já enviou, devolve OK silenciosamente
  if (s.confirmacao_enviada_em) {
    log.warn('confirmacao', `sessao ${sessaoId} já tinha confirmação enviada — skip`)
    return { ok: false, razao: 'ja_enviada' }
  }

  const agora = new Date()
  const expira = calcularJanelaConfirmacao(agora)
  const token = randomBytes(24).toString('base64url')
  const horaSessao = new Date(s.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  // Sessão grátis: o aviso não menciona pagamento (não há cobrança a liberar).
  const gratuita = Number(s.valor ?? 0) <= 0 || s.pagamento_status === 'isento'

  await db.query(
    `UPDATE sessoes SET
        confirmacao_token = $2,
        confirmacao_enviada_em = NOW(),
        confirmacao_janela_expira_em = $3
      WHERE id = $1`,
    [sessaoId, token, expira.toISOString()],
  )

  await enviarWA(s.paciente_telefone, WA_TEMPLATES.fluxo7_confirmacao({
    nomePaciente: s.paciente_nome,
    horaSessao,
    psicologa: s.psicologa_nome,
    janela: descreverJanela(expira, agora),
    linkConfirmacao: `${env.appUrl}/confirmar/${token}`,
    gratuita,
  }))

  log.ok('confirmacao', `enviada sessao=${sessaoId} expira=${expira.toISOString()}`)
  return { ok: true, token }
}

export type RespostaPaciente = 'sim' | 'contestou'
export type Canal = 'whatsapp' | 'web'

export type ProcessarResult =
  | { ok: true; jaRespondida: boolean; resposta: RespostaPaciente }
  | { ok: false; razao: 'token_invalido' | 'janela_expirada' | 'sessao_invalida' }

/**
 * Registra resposta do paciente (vinda do WhatsApp ou da página /confirmar/[token]).
 * Idempotente: se já respondeu, devolve o status atual.
 */
export async function processarResposta(
  identificador: { token?: string; sessaoId?: string },
  resposta: RespostaPaciente,
  evidencia: { canal: Canal; ip?: string | null; userAgent?: string | null },
): Promise<ProcessarResult> {
  const filtro = identificador.token
    ? { sql: `confirmacao_token = $1`, val: identificador.token }
    : { sql: `id = $1`, val: identificador.sessaoId! }

  const { rows } = await db.query<{
    id: string; confirmacao_resposta: string | null;
    confirmacao_janela_expira_em: string | null;
  }>(
    `SELECT id, confirmacao_resposta, confirmacao_janela_expira_em
       FROM sessoes WHERE ${filtro.sql} LIMIT 1`,
    [filtro.val],
  )
  const s = rows[0]
  if (!s) return { ok: false, razao: 'token_invalido' }
  // Token válido basta pra registrar a resposta. A janela só importa pro cron de
  // silêncio; se estiver nula (sessão antiga / edge de dados), NÃO bloqueamos o
  // paciente — antes isso devolvia "Sessão inválida" e travava a confirmação (#8).
  if (!s.confirmacao_janela_expira_em) {
    log.warn('confirmacao', `sessao ${s.id} sem janela definida — registrando resposta mesmo assim`)
  }

  // Já respondeu antes → idempotente
  if (s.confirmacao_resposta === 'sim' || s.confirmacao_resposta === 'contestou') {
    return { ok: true, jaRespondida: true, resposta: s.confirmacao_resposta }
  }
  // Janela expirou e silêncio já foi processado → não permite mudar
  if (s.confirmacao_resposta === 'silencio') {
    return { ok: false, razao: 'janela_expirada' }
  }

  const evid = { canal: evidencia.canal, ip: evidencia.ip ?? null, ua: evidencia.userAgent ?? null }

  await db.query(
    `UPDATE sessoes SET
        confirmacao_resposta = $2,
        confirmacao_resposta_em = NOW(),
        confirmacao_evidencia = $3::jsonb,
        pagamento_status = CASE WHEN $2 = 'contestou' THEN 'contestado' ELSE pagamento_status END
      WHERE id = $1`,
    [s.id, resposta, JSON.stringify(evid)],
  )

  log.ok('confirmacao', `resposta sessao=${s.id} resposta=${resposta} canal=${evidencia.canal}`)
  return { ok: true, jaRespondida: false, resposta }
}

/**
 * Cron: libera sessões que passaram da janela sem resposta.
 * Marca silêncio + grava timestamp. Idempotente.
 * Roda a cada N minutos via /api/cron/liberar-confirmacoes.
 */
export async function liberarSilenciosos(): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE sessoes SET
        confirmacao_resposta = 'silencio',
        confirmacao_resposta_em = NOW()
      WHERE confirmacao_resposta IS NULL
        AND confirmacao_janela_expira_em IS NOT NULL
        AND confirmacao_janela_expira_em < NOW()
      RETURNING id`,
    [],
  )
  if (rows.length > 0) log.ok('confirmacao', `liberadas ${rows.length} por silêncio`)
  return rows.length
}

/**
 * Busca sessão por número de telefone do paciente que enviou SIM/NAO no WhatsApp.
 * Usa a sessão mais recente com confirmação pendente.
 */
export async function acharSessaoPendentePorTelefone(telefone: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT s.id FROM sessoes s
       JOIN pacientes p ON p.id = s.paciente_id
      WHERE tel_canon(p.telefone) = tel_canon($1)
        AND s.confirmacao_resposta IS NULL
        AND s.confirmacao_token IS NOT NULL
      ORDER BY s.confirmacao_enviada_em DESC NULLS LAST
      LIMIT 1`,
    [telefone],
  )
  return rows[0]?.id ?? null
}
