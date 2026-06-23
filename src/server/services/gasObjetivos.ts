import 'server-only'
import { db } from '@/server/db/pool'
import { hojeBrasiliaISO } from '@/lib/formatters'

/**
 * Escalas GAS (Goal Attainment Scaling) — ferramenta de acompanhamento da Meta.
 * Opcional, editável e múltipla por Meta. 5 níveis padrão (−2..+2) descritos
 * pelo psicólogo, com marcação de partida e esperado.
 */

export type GasAndamento = { medidoEm: string; nivel: number }

export type GasEscala = {
  id: string
  objetivoId: string
  titulo: string
  nivelM2: string | null
  nivelM1: string | null
  nivel0: string | null
  nivelP1: string | null
  nivelP2: string | null
  nivelPartida: number
  nivelEsperado: number
  ativo: boolean
  andamentos: GasAndamento[]   // registros do nível ao longo do tempo (cronológico)
}

function rowToGas(r: any): GasEscala {
  return {
    id: r.id, objetivoId: r.objetivo_id, titulo: r.titulo,
    nivelM2: r.nivel_m2, nivelM1: r.nivel_m1, nivel0: r.nivel_0, nivelP1: r.nivel_p1, nivelP2: r.nivel_p2,
    nivelPartida: r.nivel_partida ?? -1,
    nivelEsperado: r.nivel_esperado ?? 2,
    ativo: r.ativo ?? true,
    andamentos: [],
  }
}

/** Todas as escalas GAS das Metas de um paciente (com andamentos), agrupadas por objetivo. */
export async function listarGasPorPaciente(pacienteId: string): Promise<Record<string, GasEscala[]>> {
  const [escRes, andRes] = await Promise.all([
    db.query(
      `SELECT g.* FROM objetivo_gas g
         JOIN objetivos o ON o.id = g.objetivo_id
        WHERE o.paciente_id = $1
        ORDER BY g.created_at ASC`,
      [pacienteId],
    ),
    db.query<{ gas_id: string; medido_em: string; valor: string }>(
      `SELECT m.gas_id, m.medido_em, m.valor FROM objetivo_medicoes m
         JOIN objetivo_gas g ON g.id = m.gas_id
         JOIN objetivos o ON o.id = g.objetivo_id
        WHERE o.paciente_id = $1 AND m.gas_id IS NOT NULL
        ORDER BY m.medido_em ASC, m.created_at ASC`,
      [pacienteId],
    ),
  ])

  const porGas: Record<string, GasAndamento[]> = {}
  for (const a of andRes.rows) {
    (porGas[a.gas_id] ??= []).push({ medidoEm: new Date(a.medido_em).toISOString().slice(0, 10), nivel: Math.round(parseFloat(a.valor)) })
  }

  const map: Record<string, GasEscala[]> = {}
  for (const r of escRes.rows) {
    const esc = rowToGas(r)
    esc.andamentos = porGas[esc.id] ?? []
    ;(map[r.objetivo_id] ??= []).push(esc)
  }
  return map
}

/** Registra o nível atual da escala GAS (−2..+2) numa data — reusa objetivo_medicoes via gas_id. */
export async function registrarAndamentoGas(
  objetivoId: string, gasId: string, nivel: number, medidoEm?: string | null,
): Promise<GasAndamento> {
  const data = medidoEm || hojeBrasiliaISO()
  const n = clampNivel(nivel, 0)
  await db.query(
    `INSERT INTO objetivo_medicoes (objetivo_id, gas_id, medido_em, valor, origem)
     VALUES ($1, $2, $3, $4, 'psicologa')`,
    [objetivoId, gasId, data, n],
  )
  return { medidoEm: data, nivel: n }
}

export type GasInput = {
  titulo: string
  nivelM2?: string | null
  nivelM1?: string | null
  nivel0?: string | null
  nivelP1?: string | null
  nivelP2?: string | null
  nivelPartida?: number
  nivelEsperado?: number
}

const clampNivel = (n: number | undefined, fb: number) =>
  n == null || isNaN(n) ? fb : Math.max(-2, Math.min(2, Math.round(n)))

export async function criarGas(objetivoId: string, input: GasInput): Promise<GasEscala> {
  const { rows } = await db.query(
    `INSERT INTO objetivo_gas
       (objetivo_id, titulo, nivel_m2, nivel_m1, nivel_0, nivel_p1, nivel_p2, nivel_partida, nivel_esperado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      objetivoId, input.titulo.trim(),
      input.nivelM2 ?? null, input.nivelM1 ?? null, input.nivel0 ?? null, input.nivelP1 ?? null, input.nivelP2 ?? null,
      clampNivel(input.nivelPartida, -1), clampNivel(input.nivelEsperado, 2),
    ],
  )
  return rowToGas(rows[0])
}

export async function atualizarGas(id: string, patch: Partial<GasInput> & { ativo?: boolean }): Promise<GasEscala | null> {
  const fields: string[] = []
  const values: any[] = [id]
  const set = (col: string, v: any) => { fields.push(`${col} = $${values.length + 1}`); values.push(v) }
  if (patch.titulo !== undefined)        set('titulo', patch.titulo.trim())
  if (patch.nivelM2 !== undefined)       set('nivel_m2', patch.nivelM2)
  if (patch.nivelM1 !== undefined)       set('nivel_m1', patch.nivelM1)
  if (patch.nivel0 !== undefined)        set('nivel_0', patch.nivel0)
  if (patch.nivelP1 !== undefined)       set('nivel_p1', patch.nivelP1)
  if (patch.nivelP2 !== undefined)       set('nivel_p2', patch.nivelP2)
  if (patch.nivelPartida !== undefined)  set('nivel_partida', clampNivel(patch.nivelPartida, -1))
  if (patch.nivelEsperado !== undefined) set('nivel_esperado', clampNivel(patch.nivelEsperado, 0))
  if (patch.ativo !== undefined)         set('ativo', patch.ativo)
  if (fields.length === 0) return null
  fields.push('updated_at = NOW()')
  const { rows } = await db.query(`UPDATE objetivo_gas SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, values)
  return rows[0] ? rowToGas(rows[0]) : null
}

export async function removerGas(id: string): Promise<void> {
  await db.query('DELETE FROM objetivo_gas WHERE id = $1', [id])
}
