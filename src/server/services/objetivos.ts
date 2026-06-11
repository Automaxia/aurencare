import 'server-only'
import { db } from '@/server/db/pool'

// 'absoluta' = métrica numérica · 'nenhuma' = Meta descritiva (acompanha por GAS) ·
// 'gas' = legado (GAS era um tipo de métrica; agora é camada à parte em objetivo_gas).
export type MetricaTipo = 'absoluta' | 'gas' | 'nenhuma'
export type MetricaDirecao = 'aumentar' | 'diminuir'

export type Objetivo = {
  id: string
  pacienteId: string
  titulo: string
  descricao: string | null
  status: 'ativo' | 'concluido' | 'pausado'
  progresso: number          // 0..100 — calculado automaticamente quando há baseline+alvo+última medição
  createdAt: string
  updatedAt: string
  // SMART
  metricaTipo: MetricaTipo
  metricaUnidade: string | null
  metricaBaseline: number | null
  metricaAlvo: number | null
  metricaDirecao: MetricaDirecao
  prazoEm: string | null     // YYYY-MM-DD
}

export type Medicao = {
  id: string
  objetivoId: string
  medidoEm: string           // YYYY-MM-DD
  valor: number
  nota: string | null
  origem: 'psicologa' | 'paciente' | 'sessao'
  sessaoId: string | null
  createdAt: string
}

function rowToObj(r: any): Objetivo {
  return {
    id: r.id, pacienteId: r.paciente_id, titulo: r.titulo, descricao: r.descricao,
    status: r.status, progresso: r.progresso,
    createdAt: r.created_at, updatedAt: r.updated_at,
    metricaTipo: (r.metrica_tipo ?? 'absoluta') as MetricaTipo,
    metricaUnidade: r.metrica_unidade,
    metricaBaseline: r.metrica_baseline != null ? parseFloat(r.metrica_baseline) : null,
    metricaAlvo: r.metrica_alvo != null ? parseFloat(r.metrica_alvo) : null,
    metricaDirecao: (r.metrica_direcao ?? 'aumentar') as MetricaDirecao,
    prazoEm: r.prazo_em ? new Date(r.prazo_em).toISOString().slice(0, 10) : null,
  }
}

function rowToMedicao(r: any): Medicao {
  return {
    id: r.id, objetivoId: r.objetivo_id,
    medidoEm: new Date(r.medido_em).toISOString().slice(0, 10),
    valor: parseFloat(r.valor),
    nota: r.nota,
    origem: r.origem,
    sessaoId: r.sessao_id,
    createdAt: r.created_at,
  }
}

/**
 * Calcula progresso 0–100 a partir de baseline, alvo e valor atual.
 * Função pura — testável. Em GAS, o cálculo é sobre a escala -2..+2.
 */
export function calcularProgresso(
  baseline: number | null, alvo: number | null, atual: number | null, direcao: MetricaDirecao,
): number {
  if (baseline == null || alvo == null || atual == null) return 0
  if (baseline === alvo) return atual === alvo ? 100 : 0
  // Aumentar: progresso = (atual - baseline) / (alvo - baseline)
  // Diminuir: progresso = (baseline - atual) / (baseline - alvo)
  const num = direcao === 'aumentar' ? atual - baseline : baseline - atual
  const den = direcao === 'aumentar' ? alvo - baseline : baseline - alvo
  const pct = (num / den) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

export async function listarObjetivos(pacienteId: string): Promise<Objetivo[]> {
  const { rows } = await db.query(
    `SELECT * FROM objetivos WHERE paciente_id = $1 ORDER BY status='concluido', created_at DESC`,
    [pacienteId],
  )
  return rows.map(rowToObj)
}

export type CriarObjetivoInput = {
  titulo: string
  descricao?: string | null
  metricaTipo?: MetricaTipo
  metricaUnidade?: string | null
  metricaBaseline?: number | null
  metricaAlvo?: number | null
  metricaDirecao?: MetricaDirecao
  prazoEm?: string | null    // YYYY-MM-DD
}

export async function criarObjetivo(pacienteId: string, input: CriarObjetivoInput): Promise<Objetivo> {
  const tipo: MetricaTipo = input.metricaTipo ?? 'absoluta'
  // Só a métrica 'absoluta' tem unidade/baseline/alvo. 'nenhuma' (descritiva, acompanhada
  // por GAS) e 'gas' (legado) não guardam números aqui.
  const numerica = tipo === 'absoluta'
  const baseline = numerica ? (input.metricaBaseline ?? null) : null
  const alvo     = numerica ? (input.metricaAlvo ?? null) : null
  const direcao: MetricaDirecao = numerica ? (input.metricaDirecao ?? 'aumentar') : 'aumentar'

  const { rows } = await db.query(
    `INSERT INTO objetivos (
       paciente_id, titulo, descricao,
       metrica_tipo, metrica_unidade, metrica_baseline, metrica_alvo, metrica_direcao,
       prazo_em
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      pacienteId, input.titulo, input.descricao ?? null,
      tipo, numerica ? (input.metricaUnidade ?? null) : null,
      baseline, alvo, direcao,
      input.prazoEm ?? null,
    ],
  )
  return rowToObj(rows[0])
}

export type AtualizarObjetivoPatch = Partial<Pick<Objetivo,
  | 'titulo' | 'descricao' | 'status' | 'progresso'
  | 'metricaUnidade' | 'metricaBaseline' | 'metricaAlvo' | 'metricaDirecao' | 'prazoEm'
>>

export async function atualizarObjetivo(id: string, patch: AtualizarObjetivoPatch): Promise<Objetivo | null> {
  const fields: string[] = []
  const values: any[] = [id]
  const set = (col: string, v: any) => { fields.push(`${col} = $${values.length + 1}`); values.push(v) }
  if (patch.titulo !== undefined)          set('titulo', patch.titulo)
  if (patch.descricao !== undefined)       set('descricao', patch.descricao)
  if (patch.status !== undefined)          set('status', patch.status)
  if (patch.progresso !== undefined)       set('progresso', Math.max(0, Math.min(100, patch.progresso)))
  if (patch.metricaUnidade !== undefined)  set('metrica_unidade', patch.metricaUnidade)
  if (patch.metricaBaseline !== undefined) set('metrica_baseline', patch.metricaBaseline)
  if (patch.metricaAlvo !== undefined)     set('metrica_alvo', patch.metricaAlvo)
  if (patch.metricaDirecao !== undefined)  set('metrica_direcao', patch.metricaDirecao)
  if (patch.prazoEm !== undefined)         set('prazo_em', patch.prazoEm)
  if (fields.length === 0) return null
  fields.push('updated_at = NOW()')
  const { rows } = await db.query(`UPDATE objetivos SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, values)
  return rows[0] ? rowToObj(rows[0]) : null
}

export async function deletarObjetivo(id: string): Promise<void> {
  await db.query('DELETE FROM objetivos WHERE id = $1', [id])
}

// ── Medições longitudinais ───────────────────────────────────────────────

export type RegistrarMedicaoInput = {
  medidoEm?: string           // YYYY-MM-DD, default = hoje
  valor: number
  nota?: string | null
  origem?: 'psicologa' | 'paciente' | 'sessao'
  sessaoId?: string | null
}

export async function registrarMedicao(objetivoId: string, input: RegistrarMedicaoInput): Promise<Medicao> {
  const medidoEm = input.medidoEm ?? new Date().toISOString().slice(0, 10)
  const { rows } = await db.query(
    `INSERT INTO objetivo_medicoes (objetivo_id, medido_em, valor, nota, origem, sessao_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [objetivoId, medidoEm, input.valor, input.nota ?? null, input.origem ?? 'psicologa', input.sessaoId ?? null],
  )

  // Recalcula progresso do objetivo com base na medição mais recente
  await recalcularProgresso(objetivoId)

  return rowToMedicao(rows[0])
}

export async function listarMedicoes(objetivoId: string): Promise<Medicao[]> {
  const { rows } = await db.query(
    `SELECT * FROM objetivo_medicoes WHERE objetivo_id = $1 ORDER BY medido_em ASC`,
    [objetivoId],
  )
  return rows.map(rowToMedicao)
}

/**
 * Valores das medições de TODOS os objetivos do paciente, em ordem cronológica,
 * por objetivo. Leve (só o número) — alimenta o sparkline de tendência dos cards.
 */
export async function valoresMedicoesPorObjetivo(pacienteId: string): Promise<Record<string, number[]>> {
  const { rows } = await db.query<{ objetivo_id: string; valor: string }>(
    `SELECT m.objetivo_id, m.valor
       FROM objetivo_medicoes m
       JOIN objetivos o ON o.id = m.objetivo_id
      WHERE o.paciente_id = $1
      ORDER BY m.medido_em ASC, m.created_at ASC`,
    [pacienteId],
  )
  const map: Record<string, number[]> = {}
  for (const r of rows) (map[r.objetivo_id] ??= []).push(parseFloat(r.valor))
  return map
}

export async function deletarMedicao(id: string, objetivoId: string): Promise<void> {
  await db.query('DELETE FROM objetivo_medicoes WHERE id = $1', [id])
  await recalcularProgresso(objetivoId)
}

/**
 * Pega a última medição (por medido_em DESC) e atualiza objetivos.progresso.
 * Roda toda vez que medições mudam. Evita N+1 na UI.
 */
async function recalcularProgresso(objetivoId: string): Promise<void> {
  const { rows } = await db.query<{
    metrica_baseline: any; metrica_alvo: any; metrica_direcao: any; valor: any;
  }>(
    `SELECT o.metrica_baseline, o.metrica_alvo, o.metrica_direcao,
            (SELECT valor FROM objetivo_medicoes
              WHERE objetivo_id = o.id
              ORDER BY medido_em DESC, created_at DESC
              LIMIT 1) AS valor
       FROM objetivos o
      WHERE o.id = $1`,
    [objetivoId],
  )
  const r = rows[0]
  if (!r || r.valor == null) return
  const pct = calcularProgresso(
    r.metrica_baseline != null ? parseFloat(r.metrica_baseline) : null,
    r.metrica_alvo != null ? parseFloat(r.metrica_alvo) : null,
    parseFloat(r.valor),
    (r.metrica_direcao ?? 'aumentar') as MetricaDirecao,
  )
  await db.query(`UPDATE objetivos SET progresso = $2, updated_at = NOW() WHERE id = $1`, [objetivoId, pct])
}

export type EvolucaoObjetivo = {
  objetivo: Objetivo
  medicoes: Medicao[]
  /** Datas (YYYY-MM-DD) de sessões assinadas no período das medições — pra marcar no gráfico. */
  sessoesNoPeriodo: Array<{ id: string; data: string; numero: number }>
}

export async function lerEvolucaoObjetivo(objetivoId: string): Promise<EvolucaoObjetivo | null> {
  const { rows: oRows } = await db.query(`SELECT * FROM objetivos WHERE id = $1 LIMIT 1`, [objetivoId])
  if (!oRows[0]) return null
  const objetivo = rowToObj(oRows[0])
  const medicoes = await listarMedicoes(objetivoId)

  // Sessões no intervalo das medições (ou últimas 6 se ainda não há medição)
  const desde = medicoes[0]?.medidoEm ?? null
  const { rows: ses } = desde
    ? await db.query<{ id: string; data_hora: string; numero: number }>(
        `SELECT id, data_hora, numero FROM sessoes
          WHERE paciente_id = $1 AND data_hora >= $2::date
            AND status IN ('concluida','confirmada','em_curso','agendada')
          ORDER BY data_hora ASC`,
        [objetivo.pacienteId, desde],
      )
    : await db.query<{ id: string; data_hora: string; numero: number }>(
        `SELECT id, data_hora, numero FROM sessoes
          WHERE paciente_id = $1
            AND status IN ('concluida','confirmada','em_curso','agendada')
          ORDER BY data_hora DESC LIMIT 6`,
        [objetivo.pacienteId],
      )

  return {
    objetivo,
    medicoes,
    sessoesNoPeriodo: ses.map(s => ({
      id: s.id, numero: s.numero,
      data: new Date(s.data_hora).toISOString().slice(0, 10),
    })),
  }
}
