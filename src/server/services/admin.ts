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
