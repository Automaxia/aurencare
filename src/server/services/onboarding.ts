import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Status de ativação do psicólogo (onboarding pós-cadastro). Determinístico,
 * derivado dos dados existentes — sem flags nem tabela nova. Os 4 passos espelham
 * a coluna do cadastro: configurar prática → 1º paciente → 1ª sessão → memória clínica.
 *
 * `completo` = já tem memória clínica (sessão assinada). Isso esconde o wizard tanto
 * pra quem terminou o onboarding quanto pra usuários antigos já estabelecidos —
 * sem nunca incomodar quem já passou desse ponto.
 */
export type OnboardingStatus = {
  configurouPratica: boolean
  temPaciente: boolean
  temSessao: boolean
  temMemoria: boolean
  concluidos: number
  completo: boolean
  pacienteEvolucaoId: string | null
}

export async function statusOnboarding(psicologoId: string): Promise<OnboardingStatus> {
  const { rows } = await db.query<{
    configurou: boolean; n_pac: number; n_sess: number; n_assin: number;
    primeiro_pac: string | null; pac_evol: string | null;
  }>(
    `SELECT
       (SELECT (valor_sessao IS NOT NULL OR wa_conectado) FROM psicologos WHERE id = $1)          AS configurou,
       (SELECT count(*)::int FROM pacientes WHERE psicologo_id = $1)                               AS n_pac,
       (SELECT count(*)::int FROM sessoes   WHERE psicologo_id = $1)                               AS n_sess,
       (SELECT count(*)::int FROM sessoes   WHERE psicologo_id = $1 AND assinada = TRUE)           AS n_assin,
       (SELECT id FROM pacientes WHERE psicologo_id = $1 ORDER BY created_at ASC LIMIT 1)          AS primeiro_pac,
       (SELECT paciente_id FROM sessoes WHERE psicologo_id = $1 AND assinada = TRUE
          ORDER BY data_hora DESC LIMIT 1)                                                         AS pac_evol`,
    [psicologoId],
  )
  const r = rows[0]
  const configurouPratica = !!r?.configurou
  const temPaciente = (r?.n_pac ?? 0) > 0
  const temSessao   = (r?.n_sess ?? 0) > 0
  const temMemoria  = (r?.n_assin ?? 0) > 0
  const concluidos = [configurouPratica, temPaciente, temSessao, temMemoria].filter(Boolean).length

  return {
    configurouPratica, temPaciente, temSessao, temMemoria,
    concluidos,
    completo: temMemoria,
    pacienteEvolucaoId: r?.pac_evol ?? r?.primeiro_pac ?? null,
  }
}
