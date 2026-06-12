import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

/**
 * Estado da conversa via WhatsApp.
 *
 * Fluxo onboarding novo paciente:
 *   inicio → coletando_nome → coletando_email → aguardando_consent → onboarded
 *
 * Fluxo de marcação/pagamento (existente):
 *   onboarded → aguardando_metodo → aguardando_pagamento → confirmado
 */
export type EstadoConversa =
  | 'inicio'                  // primeiro contato, ainda não sei quem é
  | 'coletando_nome'
  | 'coletando_email'
  | 'aguardando_consent'
  | 'onboarded'               // paciente cadastrado e consentido — pronto pra agendar
  | 'escolhendo_horario'      // (WA.3 — futuro)
  | 'aguardando_metodo'       // (WA.4 — usa fluxo existente)
  | 'aguardando_pagamento'
  | 'confirmado'
  | 'livre'                   // conversa solta, FAQ etc

export type ConversaContexto = {
  /** Coletado durante onboarding antes de criar paciente. */
  nomeColetado?: string
  emailColetado?: string
  /** Última mensagem da psicóloga / sistema (pra contexto na IA). */
  ultimaSaida?: string
  /** ID da sessão sendo agendada/paga. */
  sessaoEmFoco?: string
}

export type Conversa = {
  telefone: string
  estado: EstadoConversa
  psicologoId: string | null
  pacienteId: string | null
  contexto: ConversaContexto
  ultimaMsgEm: string
}

function rowToConversa(r: any): Conversa {
  return {
    telefone: r.telefone,
    estado: r.estado,
    psicologoId: r.psicologo_id,
    pacienteId: r.paciente_id,
    contexto: r.contexto ?? {},
    ultimaMsgEm: r.ultima_msg_em,
  }
}

/** Lê ou cria conversa pro telefone (idempotente). */
export async function obterConversa(telefone: string): Promise<Conversa> {
  const tel = normalizar(telefone)
  const { rows } = await db.query(
    `INSERT INTO wa_conversas (telefone) VALUES ($1)
     ON CONFLICT (telefone) DO UPDATE SET ultima_msg_em = NOW()
     RETURNING *`,
    [tel],
  )
  return rowToConversa(rows[0])
}

/** Atualiza estado + contexto + ultima_msg_em. */
export async function atualizarConversa(
  telefone: string,
  patch: Partial<Pick<Conversa, 'estado' | 'psicologoId' | 'pacienteId'>> & { contexto?: Partial<ConversaContexto> },
): Promise<Conversa> {
  const tel = normalizar(telefone)
  const fields: string[] = ['ultima_msg_em = NOW()', 'updated_at = NOW()']
  const params: any[] = [tel]
  if (patch.estado !== undefined)      { fields.push(`estado = $${params.length + 1}`);        params.push(patch.estado) }
  if (patch.psicologoId !== undefined) { fields.push(`psicologo_id = $${params.length + 1}`);  params.push(patch.psicologoId) }
  if (patch.pacienteId !== undefined)  { fields.push(`paciente_id = $${params.length + 1}`);   params.push(patch.pacienteId) }
  if (patch.contexto !== undefined) {
    fields.push(`contexto = coalesce(contexto, '{}'::jsonb) || $${params.length + 1}::jsonb`)
    params.push(JSON.stringify(patch.contexto))
  }
  const { rows } = await db.query(
    `UPDATE wa_conversas SET ${fields.join(', ')} WHERE telefone = $1 RETURNING *`,
    params,
  )
  return rowToConversa(rows[0])
}

/** Marca a última mensagem enviada (pra dar contexto na próxima geração IA). */
export async function registrarSaida(telefone: string, texto: string): Promise<void> {
  await atualizarConversa(telefone, { contexto: { ultimaSaida: texto.slice(0, 800) } })
}

/**
 * Persiste uma mensagem no histórico (inbox). psicologo_id/paciente_id, se não
 * passados, vêm da wa_conversas. Best-effort — nunca lança.
 */
export async function registrarMensagem(
  telefone: string, direcao: 'in' | 'out', texto: string,
  ids?: { psicologoId?: string | null; pacienteId?: string | null },
): Promise<void> {
  try {
    const tel = normalizar(telefone)
    let psicologoId = ids?.psicologoId ?? null
    let pacienteId = ids?.pacienteId ?? null
    if (psicologoId == null || pacienteId == null) {
      const { rows } = await db.query<{ psicologo_id: string | null; paciente_id: string | null }>(
        `SELECT psicologo_id, paciente_id FROM wa_conversas WHERE telefone = $1 LIMIT 1`, [tel],
      )
      psicologoId = psicologoId ?? rows[0]?.psicologo_id ?? null
      pacienteId = pacienteId ?? rows[0]?.paciente_id ?? null
    }
    await db.query(
      `INSERT INTO wa_mensagens (telefone, psicologo_id, paciente_id, direcao, texto)
       VALUES ($1, $2, $3, $4, $5)`,
      [tel, psicologoId, pacienteId, direcao, (texto ?? '').slice(0, 4000)],
    )
  } catch (err) {
    log.err('wa.mensagens', 'falha ao registrar', err)
  }
}

/** Marca a conversa como lida pela psicóloga (zera não-lidas). */
export async function marcarConversaLida(telefone: string): Promise<void> {
  await db.query(`UPDATE wa_conversas SET psi_lida_em = NOW() WHERE telefone = $1`, [normalizar(telefone)])
    .catch(() => { /* */ })
}

/** Localiza paciente pelo telefone — qualquer psicóloga. */
export async function buscarPacientePorTelefone(telefone: string): Promise<{ id: string; psicologoId: string; nome: string } | null> {
  const tel = normalizar(telefone)
  const { rows } = await db.query<{ id: string; psicologo_id: string; nome: string }>(
    `SELECT id, psicologo_id, nome FROM pacientes
      WHERE tel_canon(telefone) = tel_canon($1) LIMIT 1`,
    [tel],
  )
  return rows[0] ? { id: rows[0].id, psicologoId: rows[0].psicologo_id, nome: rows[0].nome } : null
}

/**
 * Resolve a psicóloga dona da conversa.
 * - Se a instância Evolution for informada (webhook), casa por `wa_instancia` —
 *   caminho multi-tenant correto (cada psicóloga com seu número/instância).
 * - Fallback (solo / instância única atual): a psicóloga ATIVA mais antiga.
 * Forward-compat: quando houver provisionamento por instância, o match já
 * funciona sem mudar isto. Evita o vazamento do "pega o primeiro" cego.
 */
export async function resolverPsicologo(instance?: string | null): Promise<{ id: string; nome: string } | null> {
  if (instance) {
    const { rows } = await db.query<{ id: string; nome: string }>(
      `SELECT id, nome FROM psicologos WHERE wa_instancia = $1 AND status = 'ativo' LIMIT 1`,
      [instance],
    )
    if (rows[0]) return rows[0]
  }
  const { rows } = await db.query<{ id: string; nome: string }>(
    `SELECT id, nome FROM psicologos WHERE status = 'ativo' ORDER BY created_at ASC LIMIT 1`,
  )
  return rows[0] ?? null
}

export function normalizar(telefone: string): string {
  return telefone.replace(/\D/g, '').replace(/^55/, '')
}
