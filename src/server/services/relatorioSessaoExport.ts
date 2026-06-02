import 'server-only'
import { createHash } from 'node:crypto'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { listarObjetivos } from './objetivos'

/**
 * Coleta de dados pra Relatório de Sessão (formato RELATO2).
 *
 * Diferente do prontuário multi-sessão: aqui o foco é UMA sessão específica,
 * com identificação completa do paciente, objetivos vigentes e o registro
 * desta sessão (resumo, indicadores, nota clínica).
 *
 * Conformidade: CFP 06/2019 (relatório/documento escrito).
 */

export type Psicologo = {
  nome: string
  crp: string
  email: string
  telefone: string | null
}

export type Paciente = {
  nome: string
  telefone: string
  email: string | null
  cadastradoEm: string
  // Campos opcionais que podem estar em condicoes (não estão em colunas dedicadas hoje)
  dataNascimento: string | null
  genero: string | null
  estadoCivil: string | null
  ocupacao: string | null
  endereco: string | null
  cpf: string | null
  cidConhecido: string | null
  medicacoes: string[] | null
}

export type Sessao = {
  id: string
  numero: number
  dataHora: string
  duracaoMin: number
  modalidade: string
  status: string
  assinada: boolean
  assinaturaEm: string | null
  resumo: string | null
  notaClinica: string | null   // só se psi preencheu
  indicadores: any | null
}

export type ObjetivoVigente = {
  titulo: string
  descricao: string | null
  status: 'ativo' | 'concluido' | 'pausado'
  metricaResumo: string  // ex: "ataques/semana · de 3 → 0"
  progressoPct: number
}

export type RelatorioSessaoDados = {
  psicologo: Psicologo
  paciente: Paciente
  sessao: Sessao
  objetivosAtivos: ObjetivoVigente[]
  hashIntegridade: string
  geradoEm: string
}

export async function coletarRelatorioSessao(
  psicologoId: string,
  sessaoId: string,
): Promise<RelatorioSessaoDados | null> {
  // ── Sessão (com ownership pelo paciente) ───────────────────────────
  const { rows: ses } = await db.query<{
    id: string; paciente_id: string; numero: number;
    data_hora: string; duracao_min: number; modalidade: string;
    status: string; assinada: boolean; assinatura_timestamp: string | null;
    resumo_ia: string | null; nota_clinica: string | null;
    indicadores: any;
    psi_nome: string; psi_crp: string; psi_email: string; psi_telefone: string | null;
    pac_nome: string; pac_telefone: string; pac_email: string | null;
    pac_created_at: string; pac_condicoes: any;
  }>(
    `SELECT s.id, s.paciente_id, s.numero,
            s.data_hora, s.duracao_min, s.modalidade,
            s.status, s.assinada, s.assinatura_timestamp,
            s.resumo_ia, s.nota_clinica, s.indicadores,
            ps.nome AS psi_nome, ps.crp AS psi_crp,
            ps.email AS psi_email, ps.telefone AS psi_telefone,
            p.nome AS pac_nome, p.telefone AS pac_telefone, p.email AS pac_email,
            p.created_at AS pac_created_at, p.condicoes AS pac_condicoes
       FROM sessoes s
       JOIN psicologos ps ON ps.id = s.psicologo_id
       JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.id = $1 AND s.psicologo_id = $2
      LIMIT 1`,
    [sessaoId, psicologoId],
  )
  if (ses.length === 0) return null
  const r = ses[0]

  const cond = r.pac_condicoes ?? {}

  // ── Objetivos ativos ───────────────────────────────────────────────
  const objs = await listarObjetivos(r.paciente_id)
  const objetivosAtivos: ObjetivoVigente[] = objs
    .filter(o => o.status === 'ativo')
    .map(o => ({
      titulo: o.titulo,
      descricao: o.descricao,
      status: o.status,
      progressoPct: o.progresso,
      metricaResumo: resumirMetrica(o),
    }))

  const dados: Omit<RelatorioSessaoDados, 'hashIntegridade' | 'geradoEm'> = {
    psicologo: {
      nome: r.psi_nome, crp: r.psi_crp,
      email: r.psi_email, telefone: r.psi_telefone,
    },
    paciente: {
      nome: r.pac_nome, telefone: r.pac_telefone, email: r.pac_email,
      cadastradoEm: r.pac_created_at,
      dataNascimento: cond?.dataNascimento ?? null,
      genero: cond?.genero ?? null,
      estadoCivil: cond?.estadoCivil ?? null,
      ocupacao: cond?.ocupacao ?? null,
      endereco: cond?.endereco ?? null,
      cpf: cond?.cpf ?? null,
      cidConhecido: cond?.cid ?? null,
      medicacoes: Array.isArray(cond?.medicacoes) ? cond.medicacoes : null,
    },
    sessao: {
      id: r.id,
      numero: r.numero,
      dataHora: r.data_hora,
      duracaoMin: r.duracao_min,
      modalidade: r.modalidade,
      status: r.status,
      assinada: r.assinada,
      assinaturaEm: r.assinatura_timestamp,
      resumo: tryDecrypt(r.resumo_ia),
      notaClinica: tryDecrypt(r.nota_clinica),
      indicadores: r.indicadores ?? null,
    },
    objetivosAtivos,
  }

  const geradoEm = new Date().toISOString()
  const hashIntegridade = createHash('sha256')
    .update(JSON.stringify({ ...dados, geradoEm }))
    .digest('hex')
    .slice(0, 32)

  return { ...dados, hashIntegridade, geradoEm }
}

function resumirMetrica(o: import('./objetivos').Objetivo): string {
  if (o.metricaTipo === 'gas') return 'GAS · escala −2 a +2'
  if (o.metricaUnidade && o.metricaBaseline != null && o.metricaAlvo != null) {
    return `${o.metricaUnidade} · de ${o.metricaBaseline} para ${o.metricaAlvo} (${o.metricaDirecao})`
  }
  return 'sem métrica definida'
}
