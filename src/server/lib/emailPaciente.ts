import 'server-only'
import { db } from '@/server/db/pool'
import { enviarEmail } from './email'
import { log } from './log'

/**
 * Helper centralizado pra envio de email pro paciente.
 *
 * Carrega email do paciente + email do psicólogo (Reply-To) via uma única
 * query e dispara. Faz no-op silencioso se o paciente não tem email
 * cadastrado — a comunicação primária é WhatsApp.
 */

type DadosBasicos = {
  pacienteEmail: string
  psicologoEmail: string
}

async function carregarDadosBasicosPorPaciente(pacienteId: string): Promise<DadosBasicos | null> {
  const { rows } = await db.query<{ pac_email: string | null; psi_email: string }>(
    `SELECT p.email AS pac_email, ps.email AS psi_email
       FROM pacientes p JOIN psicologos ps ON ps.id = p.psicologo_id
      WHERE p.id = $1 LIMIT 1`,
    [pacienteId],
  )
  const r = rows[0]
  if (!r || !r.pac_email) return null
  return { pacienteEmail: r.pac_email, psicologoEmail: r.psi_email }
}

async function carregarDadosBasicosPorSessao(sessaoId: string): Promise<DadosBasicos | null> {
  const { rows } = await db.query<{ pac_email: string | null; psi_email: string }>(
    `SELECT p.email AS pac_email, ps.email AS psi_email
       FROM sessoes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN psicologos ps ON ps.id = s.psicologo_id
      WHERE s.id = $1 LIMIT 1`,
    [sessaoId],
  )
  const r = rows[0]
  if (!r || !r.pac_email) return null
  return { pacienteEmail: r.pac_email, psicologoEmail: r.psi_email }
}

type Conteudo = { html: string; text: string; subject: string }

/** Dispara email pra paciente pertencente a uma sessão. No-op se sem email. */
export async function enviarEmailPacientePorSessao(
  sessaoId: string, conteudo: Conteudo, scope: string,
): Promise<void> {
  const d = await carregarDadosBasicosPorSessao(sessaoId)
  if (!d) return
  try {
    await enviarEmail({
      to: d.pacienteEmail,
      replyTo: d.psicologoEmail,
      ...conteudo,
    })
  } catch (err) {
    log.err(scope, 'falha email paciente', err instanceof Error ? err.message : err)
  }
}

/** Dispara email direto por pacienteId. No-op se sem email. */
export async function enviarEmailPacientePorId(
  pacienteId: string, conteudo: Conteudo, scope: string,
): Promise<void> {
  const d = await carregarDadosBasicosPorPaciente(pacienteId)
  if (!d) return
  try {
    await enviarEmail({
      to: d.pacienteEmail,
      replyTo: d.psicologoEmail,
      ...conteudo,
    })
  } catch (err) {
    log.err(scope, 'falha email paciente', err instanceof Error ? err.message : err)
  }
}
