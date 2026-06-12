import 'server-only'
import { db } from '@/server/db/pool'
import { enviarWA } from '@/server/lib/evolution'
import { registrarMensagem, marcarConversaLida, normalizar } from './wa-conversa'

export type ConversaResumo = {
  telefone: string
  pacienteId: string | null
  pacienteNome: string | null
  ultimaTexto: string
  ultimaDirecao: 'in' | 'out'
  ultimaEm: string
  naoLidas: number
}

export type MensagemWa = { id: string; direcao: 'in' | 'out'; texto: string; createdAt: string }

/** Lista as conversas do WhatsApp da psicóloga (mais recentes primeiro). */
export async function listarConversasWa(psicologoId: string): Promise<ConversaResumo[]> {
  const { rows } = await db.query<any>(
    `WITH msgs AS (
       SELECT m.*, row_number() OVER (PARTITION BY telefone ORDER BY created_at DESC) AS rn
         FROM wa_mensagens m WHERE m.psicologo_id = $1
     )
     SELECT last.telefone, c.paciente_id, p.nome AS paciente_nome,
            last.texto AS ultima_texto, last.direcao AS ultima_direcao, last.created_at AS ultima_em,
            (SELECT count(*)::int FROM wa_mensagens x
               WHERE x.telefone = last.telefone AND x.psicologo_id = $1 AND x.direcao = 'in'
                 AND (c.psi_lida_em IS NULL OR x.created_at > c.psi_lida_em)) AS nao_lidas
       FROM msgs last
       LEFT JOIN wa_conversas c ON c.telefone = last.telefone
       LEFT JOIN pacientes p ON p.id = c.paciente_id
      WHERE last.rn = 1
      ORDER BY last.created_at DESC`,
    [psicologoId],
  )
  return rows.map((r: any) => ({
    telefone: r.telefone,
    pacienteId: r.paciente_id,
    pacienteNome: r.paciente_nome,
    ultimaTexto: r.ultima_texto,
    ultimaDirecao: r.ultima_direcao,
    ultimaEm: r.ultima_em,
    naoLidas: r.nao_lidas ?? 0,
  }))
}

/** Histórico de uma conversa (verifica posse pelo psicologo_id das mensagens). */
export async function lerConversaWa(psicologoId: string, telefone: string): Promise<{ paciente: { id: string; nome: string } | null; mensagens: MensagemWa[] } | null> {
  const tel = normalizar(telefone)
  const { rows } = await db.query<{ id: string; direcao: 'in' | 'out'; texto: string; created_at: string }>(
    `SELECT id, direcao, texto, created_at FROM wa_mensagens
      WHERE telefone = $1 AND psicologo_id = $2 ORDER BY created_at ASC`,
    [tel, psicologoId],
  )
  if (rows.length === 0) return null

  const { rows: pac } = await db.query<{ id: string; nome: string }>(
    `SELECT p.id, p.nome FROM wa_conversas c JOIN pacientes p ON p.id = c.paciente_id WHERE c.telefone = $1 LIMIT 1`,
    [tel],
  )
  await marcarConversaLida(tel)

  return {
    paciente: pac[0] ?? null,
    mensagens: rows.map(r => ({ id: r.id, direcao: r.direcao, texto: r.texto, createdAt: r.created_at })),
  }
}

/** Psicóloga responde pelo inbox — envia WhatsApp e persiste. Verifica posse. */
export async function responderConversaWa(psicologoId: string, telefone: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const tel = normalizar(telefone)
  if (!texto.trim()) return { ok: false, error: 'Mensagem vazia.' }
  const { rows } = await db.query(`SELECT 1 FROM wa_mensagens WHERE telefone = $1 AND psicologo_id = $2 LIMIT 1`, [tel, psicologoId])
  if (!rows[0]) return { ok: false, error: 'Conversa não encontrada.' }

  await enviarWA(tel, texto).catch(() => { /* best-effort; persiste mesmo assim */ })
  await registrarMensagem(tel, 'out', texto, { psicologoId })
  await marcarConversaLida(tel)
  return { ok: true }
}
