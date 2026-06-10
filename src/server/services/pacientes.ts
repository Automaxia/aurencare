import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { enviarEmail } from '@/server/lib/email'
import { tplPacienteBoasVindas } from '@/server/lib/emailTemplates'
import { env } from '@/server/lib/env'
import { log } from '@/server/lib/log'

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
  /** Sessão concluída e NÃO assinada mais recente (alvo do CTA "Assinar"). */
  sessaoRegistroId: string | null
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

export type ListarPacientesOpts = {
  /** Inclui arquivados (status='inativo') no resultado. Default false. */
  incluirArquivados?: boolean
  /** Devolve APENAS arquivados (ignora ativos). */
  apenasArquivados?: boolean
}

export async function listarPacientes(
  psicologoId: string, opts: ListarPacientesOpts = {},
): Promise<PacienteComBadge[]> {
  const { rows: pacientes } = await db.query(
    `SELECT * FROM pacientes
       WHERE psicologo_id = $1
         ${opts.apenasArquivados ? "AND status = 'inativo'" : ''}
         ${!opts.apenasArquivados && !opts.incluirArquivados ? "AND status = 'ativo'" : ''}
      ORDER BY nome ASC`,
    [psicologoId],
  )

  if (pacientes.length === 0) return []

  const { rows: sessoes } = await db.query(
    `SELECT id, paciente_id, data_hora, status, assinada
       FROM sessoes
      WHERE psicologo_id = $1
      ORDER BY data_hora DESC`,
    [psicologoId],
  )

  return pacientes.map(p => {
    const ses = sessoes.filter(s => s.paciente_id === p.id).map(s => ({
      id: s.id as string, dataHora: s.data_hora, status: s.status, assinada: s.assinada,
    }))
    const futuras = ses.filter(s => +new Date(s.dataHora) > Date.now())
                       .sort((a, b) => +new Date(a.dataHora) - +new Date(b.dataHora))
    const passadas = ses.filter(s => +new Date(s.dataHora) <= Date.now())
    // Mais recente concluída e não assinada → alvo do "Assinar →".
    const registro = [...ses]
      .sort((a, b) => +new Date(b.dataHora) - +new Date(a.dataHora))
      .find(s => s.status === 'concluida' && !s.assinada)
    return {
      ...rowToPaciente(p),
      sessoesTotais: ses.length,
      proximaSessao: futuras[0]
        ? { id: futuras[0].id, dataHora: futuras[0].dataHora }
        : null,
      ultimaSessaoEm: passadas[0]?.dataHora ?? null,
      sessaoRegistroId: registro?.id ?? null,
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

  const link = `${env.appUrl}/onboard/${token}`

  // Busca dados do psicólogo pra usar no email (CRP + email-reply).
  const { rows: psis } = await db.query<{ crp: string; email: string }>(
    `SELECT crp, email FROM psicologos WHERE id = $1 LIMIT 1`,
    [input.psicologoId],
  )
  const psi = psis[0]

  // Fluxo 1: boas-vindas em paralelo (WhatsApp + Email).
  // Errors não bloqueiam — paciente é criado mesmo se algum canal falhar.
  await Promise.all([
    enviarWA(paciente.telefone, WA_TEMPLATES.fluxo1_boasVindas(paciente.nome, link, input.psicologoNome))
      .catch(err => log.err('paciente.criar', 'falha WA boas-vindas', err)),

    paciente.email && psi ? enviarEmail({
      to: paciente.email,
      replyTo: psi.email,
      ...tplPacienteBoasVindas({
        nomePaciente: paciente.nome,
        psicologoNome: input.psicologoNome,
        psicologoCrp: psi.crp,
        psicologoEmail: psi.email,
        link,
      }),
    }).catch(err => log.err('paciente.criar', 'falha email boas-vindas', err)) : Promise.resolve(),
  ])

  return paciente
}

// ─── Edição / Arquivar / Excluir ─────────────────────────────────────

export type AtualizarPacienteInput = {
  nome?: string
  telefone?: string
  email?: string | null
}

export type AtualizarPacienteResult =
  | { ok: true; paciente: Paciente }
  | { ok: false; error: string; campo?: 'nome' | 'telefone' | 'email' }

/**
 * Atualiza dados básicos do paciente (nome, telefone, email). Não mexe em
 * condicoes (tem service próprio) nem em consentimento.
 */
export async function atualizarPaciente(
  psicologoId: string, pacienteId: string, patch: AtualizarPacienteInput,
): Promise<AtualizarPacienteResult> {
  // Ownership
  const { rowCount: own } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId],
  )
  if (!own) return { ok: false, error: 'Paciente não encontrado.' }

  // Validações
  if (patch.nome !== undefined) {
    const n = patch.nome.trim()
    if (n.length < 3) return { ok: false, error: 'Informe o nome completo.', campo: 'nome' }
  }
  if (patch.telefone !== undefined) {
    const tel = patch.telefone.replace(/\D/g, '')
    if (tel.length < 10 || tel.length > 13) {
      return { ok: false, error: 'Telefone inválido (DDD + número).', campo: 'telefone' }
    }
  }
  if (patch.email !== undefined && patch.email !== null && patch.email !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
      return { ok: false, error: 'Email inválido.', campo: 'email' }
    }
  }

  const fields: string[] = []
  const values: any[] = [pacienteId]
  const set = (col: string, v: any) => { fields.push(`${col} = $${values.length + 1}`); values.push(v) }
  if (patch.nome !== undefined)     set('nome', patch.nome.trim())
  if (patch.telefone !== undefined) set('telefone', patch.telefone.replace(/\D/g, ''))
  if (patch.email !== undefined)    set('email', patch.email?.trim() || null)
  if (fields.length === 0) {
    const p = await buscarPacientePorId(pacienteId)
    return p ? { ok: true, paciente: p } : { ok: false, error: 'Não encontrado.' }
  }

  try {
    const { rows } = await db.query(
      `UPDATE pacientes SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    )
    if (rows.length === 0) return { ok: false, error: 'Não encontrado.' }
    log.ok('paciente.atualizar', `id=${pacienteId}`)
    return { ok: true, paciente: rowToPaciente(rows[0]) }
  } catch (err: any) {
    // Conflito de UNIQUE (psicologo_id, telefone)
    if (err?.code === '23505') {
      return { ok: false, error: 'Você já tem um paciente com esse telefone.', campo: 'telefone' }
    }
    log.err('paciente.atualizar', 'falha', err)
    return { ok: false, error: 'Não foi possível salvar agora.' }
  }
}

/** Soft delete — status='inativo'. Histórico clínico permanece (CFP 06/2019 + LGPD). */
export async function arquivarPaciente(psicologoId: string, pacienteId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE pacientes SET status = 'inativo'
      WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId],
  )
  if (rowCount) log.ok('paciente.arquivar', `id=${pacienteId}`)
  return (rowCount ?? 0) > 0
}

export async function reativarPaciente(psicologoId: string, pacienteId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE pacientes SET status = 'ativo'
      WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId],
  )
  if (rowCount) log.ok('paciente.reativar', `id=${pacienteId}`)
  return (rowCount ?? 0) > 0
}

export type ExcluirResult =
  | { ok: true }
  | { ok: false; error: string; sessoes?: number }

/**
 * Exclusão DEFINITIVA — só permitida se não houver nenhuma sessão registrada.
 * Pacientes com histórico clínico devem ser apenas arquivados (preservação
 * do prontuário conforme Resolução CFP 06/2019, guarda mínima 5 anos).
 *
 * CASCADE remove objetivos, condições, salas, conversas WA do paciente.
 */
export async function excluirPacienteDefinitivo(
  psicologoId: string, pacienteId: string,
): Promise<ExcluirResult> {
  // Ownership
  const { rowCount: own } = await db.query(
    `SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId],
  )
  if (!own) return { ok: false, error: 'Paciente não encontrado.' }

  // Bloqueio: existe alguma sessão registrada?
  const { rows: ses } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`,
    [pacienteId],
  )
  const totalSessoes = ses[0]?.n ?? 0
  if (totalSessoes > 0) {
    return {
      ok: false,
      error: `Pacientes com sessões registradas não podem ser excluídos (preservação do prontuário · CFP 06/2019). Arquive em vez disso.`,
      sessoes: totalSessoes,
    }
  }

  try {
    await db.query(`DELETE FROM pacientes WHERE id = $1`, [pacienteId])
    log.ok('paciente.excluir', `id=${pacienteId} (sem sessões)`)
    return { ok: true }
  } catch (err) {
    log.err('paciente.excluir', 'falha', err)
    return { ok: false, error: 'Não foi possível excluir agora.' }
  }
}

async function buscarPacientePorId(pacienteId: string): Promise<Paciente | null> {
  const { rows } = await db.query(`SELECT * FROM pacientes WHERE id = $1 LIMIT 1`, [pacienteId])
  return rows[0] ? rowToPaciente(rows[0]) : null
}

// ─── Dados cadastrais/demográficos (#2 — todos opcionais) ─────────────

export type ContatoEmergencia = { nome?: string; telefone?: string; email?: string }
export type DadosCadastro = {
  nomeSocial?: string
  cpf?: string
  pais?: string
  estado?: string
  cidade?: string
  racaCor?: string
  genero?: string
  estadoCivil?: string
  ocupacao?: string
  formacao?: string
  origem?: string
  contatosEmergencia?: ContatoEmergencia[]
}

export async function buscarDadosCadastro(psicologoId: string, pacienteId: string): Promise<DadosCadastro> {
  const { rows } = await db.query<{ dados_cadastro: DadosCadastro | null }>(
    `SELECT dados_cadastro FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [pacienteId, psicologoId],
  )
  return rows[0]?.dados_cadastro ?? {}
}

export async function salvarDadosCadastro(
  psicologoId: string, pacienteId: string, dados: DadosCadastro,
): Promise<{ ok: boolean }> {
  // Limpa strings vazias e contatos sem nenhum dado.
  const limpo: DadosCadastro = {}
  for (const [k, v] of Object.entries(dados)) {
    if (k === 'contatosEmergencia') continue
    const s = typeof v === 'string' ? v.trim() : v
    if (s) (limpo as any)[k] = s
  }
  const contatos = (dados.contatosEmergencia ?? [])
    .map(c => ({ nome: c.nome?.trim() || undefined, telefone: c.telefone?.replace(/\s+/g, ' ').trim() || undefined, email: c.email?.trim() || undefined }))
    .filter(c => c.nome || c.telefone || c.email)
  if (contatos.length) limpo.contatosEmergencia = contatos

  const { rowCount } = await db.query(
    `UPDATE pacientes SET dados_cadastro = $3 WHERE id = $1 AND psicologo_id = $2`,
    [pacienteId, psicologoId, JSON.stringify(limpo)],
  )
  if (rowCount) log.ok('paciente.dadosCadastro', `id=${pacienteId}`)
  return { ok: (rowCount ?? 0) > 0 }
}
