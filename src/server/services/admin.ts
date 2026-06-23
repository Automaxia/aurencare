import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Gestão da plataforma (cockpit do admin). Foco solo: lista os psicólogos,
 * mostra uso, e permite suspender/reativar e promover/rebaixar.
 * Toda autorização é no caller (requireRole('admin')).
 */

export type CockpitKpis = {
  usuarios: number
  ativos: number
  suspensos: number
  novos30: number
  pacientes: number
  sessoes: number
  pagantes: number
}

export async function obterCockpit(): Promise<CockpitKpis> {
  const { rows } = await db.query<CockpitKpis>(`
    SELECT
      (SELECT count(*) FROM psicologos)                                                          AS usuarios,
      (SELECT count(*) FROM psicologos WHERE status = 'ativo')                                   AS ativos,
      (SELECT count(*) FROM psicologos WHERE status IN ('suspenso','inativo','bloqueado'))       AS suspensos,
      (SELECT count(*) FROM psicologos WHERE created_at >= NOW() - INTERVAL '30 days')           AS novos30,
      (SELECT count(*) FROM pacientes WHERE status = 'ativo')                                    AS pacientes,
      (SELECT count(*) FROM sessoes)                                                             AS sessoes,
      (SELECT count(*) FROM psicologos WHERE plano IS NOT NULL AND plano <> 'free')              AS pagantes
  `)
  return rows[0]
}

/**
 * Cockpit de PRODUTO (não cadastro). Responde "o produto gera valor?":
 * crescimento, adoção real, funil de ativação, saúde de uso e receita.
 * Tudo determinístico, em poucas queries. Unit economics de IA vêm de resumoCustos().
 */
export type CockpitProduto = {
  // Crescimento
  usuarios: number
  novos30: number
  ativosConta: number
  pagantes: number
  pacientesAtivos: number
  // Adoção (psicólogos distintos que chegaram a cada etapa)
  comPacientes: number
  comSessao: number
  comEvolucao: number
  comObjetivos: number
  comMemoria: number
  // Ativação (paciente + sessão realizada + evolução assinada)
  ativados: number
  // Saúde do produto (uso acumulado)
  sessoesRegistradas: number
  evolucoesAssinadas: number
  objetivosCriados: number
  temasIdentificados: number
  consultasMemoria: number
  sessoesComIA: number
  tokensMes: number
  // Receita
  pagEssencial: number
  pagPro: number
  valorMedioSessaoPaga: number
}

export async function obterCockpitProduto(): Promise<CockpitProduto> {
  const [esc, tok] = await Promise.all([
    db.query<any>(`
      SELECT
        (SELECT count(*) FROM psicologos)                                                        AS usuarios,
        (SELECT count(*) FROM psicologos WHERE created_at >= NOW() - INTERVAL '30 days')         AS novos30,
        (SELECT count(*) FROM psicologos WHERE status = 'ativo')                                 AS ativos_conta,
        (SELECT count(*) FROM psicologos WHERE plano IS NOT NULL AND plano <> 'free' AND plano_status = 'ativo') AS pagantes,
        (SELECT count(*) FROM pacientes WHERE status = 'ativo')                                  AS pacientes_ativos,
        (SELECT count(DISTINCT psicologo_id) FROM pacientes)                                     AS com_pacientes,
        (SELECT count(DISTINCT psicologo_id) FROM sessoes WHERE status = 'concluida')            AS com_sessao,
        (SELECT count(DISTINCT psicologo_id) FROM sessoes WHERE assinada = TRUE)                 AS com_evolucao,
        (SELECT count(DISTINCT pa.psicologo_id) FROM objetivos o JOIN pacientes pa ON pa.id = o.paciente_id) AS com_objetivos,
        (SELECT count(DISTINCT psicologo_id) FROM prontuarios_ia)                                AS com_memoria,
        (SELECT count(*) FROM psicologos p
            WHERE EXISTS (SELECT 1 FROM pacientes pa WHERE pa.psicologo_id = p.id)
              AND EXISTS (SELECT 1 FROM sessoes s WHERE s.psicologo_id = p.id AND s.status = 'concluida')
              AND EXISTS (SELECT 1 FROM sessoes s WHERE s.psicologo_id = p.id AND s.assinada = TRUE)) AS ativados,
        (SELECT count(*) FROM sessoes WHERE status = 'concluida')                                AS sessoes_registradas,
        (SELECT count(*) FROM sessoes WHERE assinada = TRUE)                                     AS evolucoes_assinadas,
        (SELECT count(*) FROM objetivos)                                                         AS objetivos_criados,
        (SELECT count(*) FROM palavras_chave)                                                    AS temas_identificados,
        (SELECT count(*) FROM prontuarios_ia)                                                    AS consultas_memoria,
        (SELECT COALESCE(SUM(sessoes_ia),0) FROM uso_mensal)                                     AS sessoes_com_ia,
        (SELECT count(*) FROM psicologos WHERE plano = 'essencial' AND plano_status = 'ativo')   AS pag_essencial,
        (SELECT count(*) FROM psicologos WHERE plano = 'pro' AND plano_status = 'ativo')         AS pag_pro,
        (SELECT COALESCE(AVG(valor),0)::float FROM sessoes WHERE pagamento_status = 'pago' AND valor IS NOT NULL) AS valor_medio_sessao
    `),
    db.query<{ t: string }>(`SELECT COALESCE(SUM(tokens_entrada + tokens_saida),0) AS t FROM api_custos WHERE provider = 'anthropic' AND created_at >= date_trunc('month', NOW())`),
  ])
  const r = esc.rows[0]
  return {
    usuarios: Number(r.usuarios), novos30: Number(r.novos30), ativosConta: Number(r.ativos_conta), pagantes: Number(r.pagantes),
    pacientesAtivos: Number(r.pacientes_ativos),
    comPacientes: Number(r.com_pacientes), comSessao: Number(r.com_sessao), comEvolucao: Number(r.com_evolucao),
    comObjetivos: Number(r.com_objetivos), comMemoria: Number(r.com_memoria), ativados: Number(r.ativados),
    sessoesRegistradas: Number(r.sessoes_registradas), evolucoesAssinadas: Number(r.evolucoes_assinadas),
    objetivosCriados: Number(r.objetivos_criados), temasIdentificados: Number(r.temas_identificados),
    consultasMemoria: Number(r.consultas_memoria), sessoesComIA: Number(r.sessoes_com_ia), tokensMes: Number(tok.rows[0].t),
    pagEssencial: Number(r.pag_essencial), pagPro: Number(r.pag_pro), valorMedioSessaoPaga: Number(r.valor_medio_sessao),
  }
}

export type UsuarioAdmin = {
  id: string
  nome: string
  email: string
  crp: string
  role: string
  status: string
  plano: string | null
  planoStatus: string | null
  pacientes: number
  sessoes: number
  createdAt: string
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const { rows } = await db.query<any>(`
    SELECT p.id, p.nome, p.email, p.crp, p.role, p.status, p.plano, p.plano_status, p.created_at,
           (SELECT count(*) FROM pacientes pa WHERE pa.psicologo_id = p.id AND pa.status = 'ativo') AS pacientes,
           (SELECT count(*) FROM sessoes s  WHERE s.psicologo_id  = p.id)                            AS sessoes
      FROM psicologos p
     ORDER BY p.created_at ASC
  `)
  return rows.map((r: any) => ({
    id: r.id, nome: r.nome, email: r.email, crp: r.crp,
    role: r.role ?? 'psicologo', status: r.status ?? 'ativo',
    plano: r.plano ?? null, planoStatus: r.plano_status ?? null,
    pacientes: Number(r.pacientes), sessoes: Number(r.sessoes),
    createdAt: r.created_at,
  }))
}

export type AdminResult = { ok: true } | { ok: false; error: string }

/** Suspende/reativa um usuário. Não permite mexer na própria conta (anti-lockout). */
export async function definirStatusUsuario(adminId: string, alvoId: string, status: 'ativo' | 'suspenso'): Promise<AdminResult> {
  if (alvoId === adminId) return { ok: false, error: 'Você não pode suspender a própria conta.' }
  if (!['ativo', 'suspenso'].includes(status)) return { ok: false, error: 'Status inválido.' }
  await db.query('UPDATE psicologos SET status = $2 WHERE id = $1', [alvoId, status])
  return { ok: true }
}

/** Promove/rebaixa papel. Não permite alterar o próprio papel (anti-lockout). */
export async function definirRoleUsuario(adminId: string, alvoId: string, role: 'admin' | 'psicologo'): Promise<AdminResult> {
  if (alvoId === adminId) return { ok: false, error: 'Você não pode alterar o próprio papel.' }
  if (!['admin', 'psicologo'].includes(role)) return { ok: false, error: 'Papel inválido.' }
  await db.query('UPDATE psicologos SET role = $2 WHERE id = $1', [alvoId, role])
  return { ok: true }
}
