import 'server-only'
import { db } from '@/server/db/pool'

export type SessaoAtiva = {
  id: string
  pacienteNome: string
  numero: number
  iniciadaEm: string | null
}

export type Pendencia = {
  id: string
  tipo: 'registrar' | 'cobranca' | 'consentimento'
  label: string
  href: string
  data?: string
}

export type Atalhos = {
  sessaoAtiva: SessaoAtiva | null
  pendencias: Pendencia[]
}

/**
 * Dados que alimentam a topbar — sessão em curso + pendências.
 * Chamado no layout (server-side) e atualizado pela UI via SSE.
 */
export async function obterAtalhos(psicologoId: string): Promise<Atalhos> {
  // 1) Sessão ativa = última em curso do psicólogo, ainda dentro de 4h da data prevista.
  const { rows: ativa } = await db.query<{ id: string; numero: number; data_hora: string; paciente_nome: string }>(
    `SELECT s.id, s.numero, s.data_hora, p.nome AS paciente_nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1 AND s.status = 'em_curso'
      ORDER BY s.data_hora DESC
      LIMIT 1`,
    [psicologoId],
  )
  const sessaoAtiva: SessaoAtiva | null = ativa[0]
    ? { id: ativa[0].id, pacienteNome: ativa[0].paciente_nome, numero: ativa[0].numero, iniciadaEm: ativa[0].data_hora }
    : null

  // 2) Pendências:
  //    a) Sessões concluídas mas não assinadas (registrar)
  //    b) Sessões aguardando método/pagamento (cobrança)
  //    c) Pacientes sem consentimento aceito há > 1 dia
  const { rows: pRegistrar } = await db.query<{ id: string; data_hora: string; nome: string }>(
    `SELECT s.id, s.data_hora, p.nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1 AND s.status = 'concluida' AND s.assinada = FALSE
      ORDER BY s.data_hora DESC LIMIT 6`,
    [psicologoId],
  )

  const { rows: pCobranca } = await db.query<{ id: string; data_hora: string; nome: string }>(
    `SELECT s.id, s.data_hora, p.nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1
        AND s.status IN ('aguardando_metodo','aguardando_pagamento')
        AND s.data_hora >= NOW() - INTERVAL '7 days'
      ORDER BY s.data_hora DESC LIMIT 6`,
    [psicologoId],
  )

  const { rows: pConsent } = await db.query<{ id: string; nome: string; created_at: string }>(
    `SELECT id, nome, created_at FROM pacientes
      WHERE psicologo_id = $1 AND consentimento_aceito = FALSE
        AND created_at < NOW() - INTERVAL '1 day'
      ORDER BY created_at DESC LIMIT 4`,
    [psicologoId],
  )

  const pendencias: Pendencia[] = [
    ...pRegistrar.map(r => ({
      id: `reg-${r.id}`,
      tipo: 'registrar' as const,
      label: `Registrar — ${r.nome}`,
      href: `/sessao/${r.id}`,
      data: r.data_hora,
    })),
    ...pCobranca.map(r => ({
      id: `cob-${r.id}`,
      tipo: 'cobranca' as const,
      label: `Pagamento pendente — ${r.nome}`,
      href: `/sessao/${r.id}`,
      data: r.data_hora,
    })),
    ...pConsent.map(r => ({
      id: `con-${r.id}`,
      tipo: 'consentimento' as const,
      label: `Aguardando consentimento — ${r.nome}`,
      href: `/pacientes/${r.id}`,
      data: r.created_at,
    })),
  ]

  return { sessaoAtiva, pendencias }
}
