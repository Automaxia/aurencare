import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { env } from '@/server/lib/env'

export type Paciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: 'ativo' | 'inativo'
  consentimentoAceito: boolean
  consentimentoToken: string | null
  createdAt: string
}

export type PacienteComBadge = Paciente & {
  badge: BadgeInfo | null
  proximaSessao: { id: string; dataHora: string } | null
  ultimaSessaoEm: string | null
  sessoesTotais: number
}

export type BadgeInfo = { label: string; color: 'rose' | 'amber' | 'info' | 'sage' }

function rowToPaciente(r: any): Paciente {
  return {
    id: r.id, nome: r.nome, telefone: r.telefone, email: r.email,
    status: r.status, consentimentoAceito: r.consentimento_aceito,
    consentimentoToken: r.consentimento_token, createdAt: r.created_at,
  }
}

/**
 * Badge automático §13.
 */
export function calcularBadge(args: {
  sessoes: { dataHora: string; status: string; assinada: boolean | null }[]
}): BadgeInfo | null {
  const ordenadas = [...args.sessoes].sort((a, b) => +new Date(b.dataHora) - +new Date(a.dataHora))
  const ultima = ordenadas[0]
  const diasDesdeUltima = ultima ? Math.floor((Date.now() - +new Date(ultima.dataHora)) / 86_400_000) : null
  const ultimas5 = ordenadas.slice(0, 5)
  const noShows = ultimas5.filter(s => s.status === 'no_show').length
  const pendentesRegistro = ordenadas.filter(s => s.status === 'concluida' && !s.assinada)

  if (noShows >= 2) return { label: 'Atenção', color: 'rose' }
  if (diasDesdeUltima !== null && diasDesdeUltima > 14) return { label: 'Espaçando', color: 'amber' }
  if (ordenadas.length < 4) return { label: 'Nova', color: 'info' }
  if (pendentesRegistro.length > 0) return { label: 'Registrar', color: 'amber' }
  return null
}

export async function listarPacientes(psicologoId: string): Promise<PacienteComBadge[]> {
  const { rows: pacientes } = await db.query(
    `SELECT * FROM pacientes WHERE psicologo_id = $1 ORDER BY nome ASC`,
    [psicologoId],
  )

  if (pacientes.length === 0) return []

  const { rows: sessoes } = await db.query(
    `SELECT paciente_id, data_hora, status, assinada
       FROM sessoes
      WHERE psicologo_id = $1
      ORDER BY data_hora DESC`,
    [psicologoId],
  )

  return pacientes.map(p => {
    const ses = sessoes.filter(s => s.paciente_id === p.id).map(s => ({
      dataHora: s.data_hora, status: s.status, assinada: s.assinada,
    }))
    const futuras = ses.filter(s => +new Date(s.dataHora) > Date.now())
                       .sort((a, b) => +new Date(a.dataHora) - +new Date(b.dataHora))
    const passadas = ses.filter(s => +new Date(s.dataHora) <= Date.now())
    return {
      ...rowToPaciente(p),
      sessoesTotais: ses.length,
      proximaSessao: futuras[0]
        ? { id: '', dataHora: futuras[0].dataHora }
        : null,
      ultimaSessaoEm: passadas[0]?.dataHora ?? null,
      badge: calcularBadge({ sessoes: ses }),
    }
  })
}

export type CriarPacienteInput = {
  psicologoId: string
  psicologoNome: string
  nome: string
  telefone: string
  email?: string | null
}

export async function criarPaciente(input: CriarPacienteInput): Promise<Paciente> {
  const token = randomUUID().replace(/-/g, '').slice(0, 24)
  const { rows } = await db.query(
    `INSERT INTO pacientes (psicologo_id, nome, telefone, email, consentimento_token)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.psicologoId, input.nome.trim(), input.telefone.replace(/\D/g, ''), input.email?.trim() || null, token],
  )
  const paciente = rowToPaciente(rows[0])

  // Fluxo 1: boas-vindas via WhatsApp.
  const link = `${env.appUrl}/onboard/${token}`
  await enviarWA(paciente.telefone, WA_TEMPLATES.fluxo1_boasVindas(paciente.nome, link, input.psicologoNome))

  return paciente
}
