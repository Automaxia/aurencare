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
    /*
     * Ainda sem dono: cai no cadastro do paciente. `wa_conversas` só ganha
     * linha quando o paciente ESCREVE, então a primeira mensagem enviada a um
     * paciente novo (boas-vindas) ficava com psicologo_id nulo — e o inbox,
     * que filtra por psicologo_id, nunca a mostrava.
     */
    if (psicologoId == null || pacienteId == null) {
      const pac = await buscarPacientePorTelefone(tel)
      psicologoId = psicologoId ?? pac?.psicologoId ?? null
      pacienteId = pacienteId ?? pac?.id ?? null
    }
    /*
    * Grava o telefone CANÔNICO. O que sai daqui tem 11 dígitos
    * (`61999423445`), mas o que a Evolution entrega vem sem o nono
    * (`6199423445`) — o JID brasileiro do WhatsApp varia. Guardando cru, ida e
    * volta da MESMA pessoa viravam duas conversas no inbox, que agrupa por
    * telefone. `tel_canon` já é o critério usado para achar o paciente.
    */
    await db.query(
      `INSERT INTO wa_mensagens (telefone, psicologo_id, paciente_id, direcao, texto)
       VALUES (COALESCE(tel_canon($1), $1), $2, $3, $4, $5)`,
      [tel, psicologoId, pacienteId, direcao, (texto ?? '').slice(0, 4000)],
    )
  } catch (err) {
    log.err('wa.mensagens', 'falha ao registrar', err)
  }
}

/** Marca a conversa como lida pela psicóloga (zera não-lidas). */
export async function marcarConversaLida(telefone: string): Promise<void> {
  await db.query(
    `UPDATE wa_conversas SET psi_lida_em = NOW()
      WHERE COALESCE(tel_canon(telefone), telefone) = COALESCE(tel_canon($1), $1)`,
    [normalizar(telefone)])
    .catch(() => { /* */ })
}

/** Localiza paciente pelo telefone — qualquer psicóloga.
 *  WhatsApp é compartilhado no beta, então o MESMO telefone pode estar cadastrado
 *  em 2+ contas (ex.: um tester usando o próprio número em duas). Desempata pelo
 *  relacionamento mais ATIVO: sessão mais recente; se empatar, cadastro mais novo.
 *  Assim a resposta cai na conta que está de fato conversando com aquele número. */
export async function buscarPacientePorTelefone(telefone: string): Promise<{ id: string; psicologoId: string; nome: string } | null> {
  const tel = normalizar(telefone)
  const { rows } = await db.query<{ id: string; psicologo_id: string; nome: string }>(
    `SELECT p.id, p.psicologo_id, p.nome
       FROM pacientes p
       LEFT JOIN LATERAL (
         SELECT max(s.data_hora) AS ult FROM sessoes s WHERE s.paciente_id = p.id
       ) us ON TRUE
      WHERE tel_canon(p.telefone) = tel_canon($1)
      ORDER BY us.ult DESC NULLS LAST, p.created_at DESC
      LIMIT 1`,
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
/**
 * De quem é esta conversa — na ordem em que a pergunta deve ser respondida:
 *
 *   1. o psicólogo DO PACIENTE, quando o número já é cadastrado;
 *   2. o psicólogo que a conversa já tinha;
 *   3. só então a instância do WhatsApp.
 *
 * A ordem importa porque o passo 3 erra em produção: `EVOLUTION_INSTANCE_NAME`
 * é `Automaxia`, valor que nenhum `psicologos.wa_instancia` tem — a instância é
 * compartilhada no beta. Sem correspondência, `resolverPsicologo` cai no
 * "psicólogo ativo mais antigo", então TODA mensagem recebida era arquivada na
 * caixa de entrada dele, inclusive as de pacientes de outras psicólogas. Isso é
 * quebra de sigilo, não só inbox errado.
 *
 * O paciente é a fonte mais confiável: ele pertence a exatamente um psicólogo.
 */
export async function donoDaConversa(
  telefone: string,
  instance?: string | null,
): Promise<{ id: string; nome: string } | null> {
  const tel = normalizar(telefone)

  const pac = await buscarPacientePorTelefone(tel).catch(() => null)
  if (pac) {
    const { rows } = await db.query<{ id: string; nome: string }>(
      `SELECT id, nome FROM psicologos WHERE id = $1 AND status = 'ativo' LIMIT 1`,
      [pac.psicologoId],
    )
    if (rows[0]) return rows[0]
  }

  const { rows: conv } = await db.query<{ id: string; nome: string }>(
    `SELECT p.id, p.nome
       FROM wa_conversas c JOIN psicologos p ON p.id = c.psicologo_id
      WHERE c.telefone = $1 AND p.status = 'ativo' LIMIT 1`,
    [tel],
  )
  if (conv[0]) return conv[0]

  return resolverPsicologo(instance)
}

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
