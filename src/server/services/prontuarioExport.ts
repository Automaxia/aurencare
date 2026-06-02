import 'server-only'
import { createHash } from 'node:crypto'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { listarObjetivos, listarMedicoes } from './objetivos'
import { lerMarcos, type Marco } from './marcos'

/**
 * Coleta os dados necessários pra exportação do prontuário em conformidade
 * com Resolução CFP 06/2019 (estrutura mínima) + 01/2009 (guarda 5 anos).
 *
 * NÃO renderiza o PDF — apenas devolve a estrutura serializável. O renderer
 * fica em prontuarioPdf.tsx.
 */

export type ProntuarioPsicologo = {
  nome: string
  crp: string
  email: string
  telefone: string | null
}

export type ProntuarioPaciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  cadastradoEm: string
  consentimento: {
    aceito: boolean
    aceitoEm: string | null
  }
  condicoes: { cid?: string; medicacoes?: string[]; alertas?: string[] } | null
}

export type ProntuarioSessao = {
  numero: number
  dataHora: string
  duracaoMin: number
  modalidade: string
  status: string
  assinada: boolean
  assinaturaEm: string | null
  resumo: string | null
  transcricao: string | null     // só presente se incluirTranscricoes=true
  indicadores: any | null
}

export type ProntuarioObjetivo = {
  titulo: string
  descricao: string | null
  status: string
  metricaTipo: 'absoluta' | 'gas'
  metricaUnidade: string | null
  metricaBaseline: number | null
  metricaAlvo: number | null
  metricaDirecao: 'aumentar' | 'diminuir'
  prazoEm: string | null
  progresso: number
  medicoes: Array<{ data: string; valor: number; nota: string | null }>
}

export type ProntuarioDados = {
  psicologo: ProntuarioPsicologo
  paciente: ProntuarioPaciente
  sessoes: ProntuarioSessao[]
  objetivos: ProntuarioObjetivo[]
  marcos: Marco[]
  /** Total de sessões assinadas (resumo numérico no topo). */
  totaisAssinadas: number
  /** Hash SHA-256 do conteúdo serializado — integridade. */
  hashIntegridade: string
  /** Timestamp da geração. */
  geradoEm: string
  /** Se incluiu transcrições no payload. */
  incluiuTranscricoes: boolean
}

export type ColetarOpts = {
  incluirTranscricoes?: boolean
}

export async function coletarDadosProntuario(
  psicologoId: string,
  pacienteId: string,
  opts: ColetarOpts = {},
): Promise<ProntuarioDados | null> {
  // ── Psicólogo ──────────────────────────────────────────────────────
  const { rows: psis } = await db.query<{
    nome: string; crp: string; email: string; telefone: string | null;
  }>(
    `SELECT nome, crp, email, telefone FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  if (psis.length === 0) return null
  const psicologo = psis[0]

  // ── Paciente (com checagem de ownership) ───────────────────────────
  const { rows: pacs } = await db.query<{
    id: string; nome: string; telefone: string; email: string | null;
    consentimento_aceito: boolean; consentimento_timestamp: string | null;
    condicoes: any; created_at: string;
  }>(
    `SELECT id, nome, telefone, email,
            consentimento_aceito, consentimento_timestamp, condicoes, created_at
       FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [pacienteId, psicologoId],
  )
  if (pacs.length === 0) return null
  const p = pacs[0]
  const paciente: ProntuarioPaciente = {
    id: p.id,
    nome: p.nome,
    telefone: p.telefone,
    email: p.email,
    cadastradoEm: p.created_at,
    consentimento: {
      aceito: p.consentimento_aceito,
      aceitoEm: p.consentimento_timestamp,
    },
    condicoes: p.condicoes ?? null,
  }

  // ── Sessões assinadas ────────────────────────────────────────────────
  const { rows: ses } = await db.query<{
    numero: number; data_hora: string; duracao_min: number; modalidade: string;
    status: string; assinada: boolean; assinatura_timestamp: string | null;
    resumo_ia: string | null; transcricao_texto: string | null;
    indicadores: any;
  }>(
    `SELECT numero, data_hora, duracao_min, modalidade,
            status, assinada, assinatura_timestamp,
            resumo_ia, transcricao_texto, indicadores
       FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora ASC`,
    [pacienteId],
  )
  const sessoes: ProntuarioSessao[] = ses.map(r => ({
    numero: r.numero,
    dataHora: r.data_hora,
    duracaoMin: r.duracao_min,
    modalidade: r.modalidade,
    status: r.status,
    assinada: r.assinada,
    assinaturaEm: r.assinatura_timestamp,
    resumo: tryDecrypt(r.resumo_ia),
    transcricao: opts.incluirTranscricoes ? tryDecrypt(r.transcricao_texto) : null,
    indicadores: r.indicadores ?? null,
  }))

  // ── Objetivos com medições ───────────────────────────────────────────
  const objs = await listarObjetivos(pacienteId)
  const objetivos: ProntuarioObjetivo[] = []
  for (const o of objs) {
    const meds = await listarMedicoes(o.id)
    objetivos.push({
      titulo: o.titulo,
      descricao: o.descricao,
      status: o.status,
      metricaTipo: o.metricaTipo,
      metricaUnidade: o.metricaUnidade,
      metricaBaseline: o.metricaBaseline,
      metricaAlvo: o.metricaAlvo,
      metricaDirecao: o.metricaDirecao,
      prazoEm: o.prazoEm,
      progresso: o.progresso,
      medicoes: meds.map(m => ({ data: m.medidoEm, valor: m.valor, nota: m.nota })),
    })
  }

  // ── Marcos do processo ──────────────────────────────────────────────
  let marcos: Marco[] = []
  try { marcos = await lerMarcos(pacienteId) } catch { /* cache miss + falha IA — segue sem marcos */ }

  const geradoEm = new Date().toISOString()
  const dadosSemHash = { psicologo, paciente, sessoes, objetivos, marcos, geradoEm }
  const hashIntegridade = createHash('sha256')
    .update(JSON.stringify(dadosSemHash))
    .digest('hex')
    .slice(0, 32)

  return {
    psicologo,
    paciente,
    sessoes,
    objetivos,
    marcos,
    totaisAssinadas: sessoes.length,
    hashIntegridade,
    geradoEm,
    incluiuTranscricoes: !!opts.incluirTranscricoes,
  }
}
