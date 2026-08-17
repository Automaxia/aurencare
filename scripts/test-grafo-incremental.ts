/**
 * Teste de integração do recálculo INCREMENTAL do grafo de temas.
 *
 * ⚠️ FAZ CHAMADAS DE IA REAIS E PAGAS (poucas: ~6). Rode contra TESTE/staging.
 *
 *   npm run test:grafo-incremental
 *
 * Afirma que:
 *   1ª passada  → extrai todas as sessões (store vazio)
 *   2ª passada  → reaproveita todas, 0 chamadas de IA (nada mudou)
 *   com forcar  → reextrai todas (escape hatch)
 *   conceitualização nova → invalida os snapshots e reextrai
 *
 * O nº de chamadas é medido em `api_custos` (instrumentação da Tarefa 1), não
 * inferido — é o mesmo lugar de onde sai a conta no fim do mês.
 */
import { db } from '@/server/db/pool'
import { encrypt } from '@/server/lib/crypto'
import { recalcularGrafo } from '@/server/services/temas'

const SESSOES = 3

function transcricaoSintetica(n: number): string {
  const temas = ['ansiedade no trabalho', 'a relação com minha mãe', 'medo de falhar']
  const linhas: string[] = []
  for (let i = 0; i < 6; i++) {
    const t = temas[(n + i) % temas.length]
    linhas.push(`P: E como foi essa semana com ${t}?`)
    linhas.push(`C: Essa semana ${t} apareceu de novo. Quando isso acontece eu tendo a me fechar e fico ruminando. Ainda sinto aquele aperto no peito.`)
  }
  return linhas.join('\n')
}

/** Chamadas de IA de extração de grafo registradas para o paciente. */
async function chamadasIA(pacienteId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT COUNT(*) n FROM api_custos WHERE paciente_id = $1 AND operacao LIKE 'temas.grafo%'`,
    [pacienteId],
  )
  return Number(rows[0].n)
}

/**
 * O registro de custo em llm.ts é fire-and-forget: espera estabilizar antes de
 * contar, senão o teste lê um número menor do que o real.
 */
async function aguardarCustos(pacienteId: string): Promise<number> {
  let anterior = -1
  for (let i = 0; i < 25; i++) {
    const n = await chamadasIA(pacienteId)
    if (n === anterior) return n
    anterior = n
    await new Promise(r => setTimeout(r, 400))
  }
  return anterior
}

let falhou = false
function afirmar(descricao: string, condicao: boolean, detalhe: string) {
  console.log(`${condicao ? '✓' : '✗'} ${descricao} — ${detalhe}`)
  if (!condicao) falhou = true
}

async function main() {
  const psi = (await db.query<{ id: string }>(`SELECT id FROM psicologos ORDER BY created_at LIMIT 1`)).rows[0]
  if (!psi) { console.error('Sem psicólogo no banco — rode o seed antes.'); process.exit(1) }

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO pacientes (psicologo_id, nome, telefone, demo, status)
     VALUES ($1, '__test_incremental', $2, TRUE, 'ativo') RETURNING id`,
    [psi.id, `inc${Date.now() % 1e8}`],
  )
  const pacienteId = rows[0].id
  const base = Date.now() - SESSOES * 7 * 24 * 3600 * 1000

  try {
    for (let i = 1; i <= SESSOES; i++) {
      await db.query(
        `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, status, assinada, valor, pagamento_status, transcricao_texto)
         VALUES ($1,$2,$3,$4,'concluida',TRUE,0,'isento',$5)`,
        [psi.id, pacienteId, i, new Date(base + i * 7 * 24 * 3600 * 1000).toISOString(), encrypt(transcricaoSintetica(i))],
      )
    }

    // ── 1ª passada: store vazio, extrai tudo ──────────────────────────────
    const r1 = await recalcularGrafo(pacienteId, 'clinico')
    const c1 = await aguardarCustos(pacienteId)
    afirmar('1ª passada extrai todas as sessões', r1.reextraidas === SESSOES && r1.reaproveitadas === 0,
      `reextraidas=${r1.reextraidas} reaproveitadas=${r1.reaproveitadas} chamadasIA=${c1}`)
    afirmar('1ª passada gerou nós no agregado', r1.nodes > 0, `nodes=${r1.nodes}`)

    // ── 2ª passada: nada mudou → reaproveita tudo, ZERO chamadas ──────────
    const r2 = await recalcularGrafo(pacienteId, 'clinico')
    const c2 = await aguardarCustos(pacienteId)
    afirmar('2ª passada reaproveita tudo', r2.reextraidas === 0 && r2.reaproveitadas === SESSOES,
      `reextraidas=${r2.reextraidas} reaproveitadas=${r2.reaproveitadas}`)
    afirmar('2ª passada NÃO chamou a IA', c2 === c1, `chamadas antes=${c1} depois=${c2}`)
    afirmar('2ª passada preservou o agregado', r2.nodes === r1.nodes, `nodes=${r2.nodes} (antes ${r1.nodes})`)

    // ── forcar: reextrai tudo mesmo com snapshot válido ───────────────────
    const r3 = await recalcularGrafo(pacienteId, 'clinico', { forcar: true })
    const c3 = await aguardarCustos(pacienteId)
    afirmar('forcar reextrai tudo', r3.reextraidas === SESSOES && r3.reaproveitadas === 0,
      `reextraidas=${r3.reextraidas} reaproveitadas=${r3.reaproveitadas}`)
    afirmar('forcar chamou a IA de novo', c3 > c2, `chamadas antes=${c2} depois=${c3}`)

    // ── conceitualização nova invalida os snapshots ───────────────────────
    await db.query(
      `INSERT INTO objetivos (paciente_id, titulo, descricao, status) VALUES ($1, $2, $3, 'ativo')`,
      [pacienteId, 'Reduzir evitação social', 'Aumentar exposição gradual a situações sociais'],
    )
    const r4 = await recalcularGrafo(pacienteId, 'clinico')
    afirmar('conceitualização nova invalida os snapshots', r4.reextraidas === SESSOES && r4.reaproveitadas === 0,
      `reextraidas=${r4.reextraidas} reaproveitadas=${r4.reaproveitadas}`)

    // ── e depois dela, volta a reaproveitar ───────────────────────────────
    const r5 = await recalcularGrafo(pacienteId, 'clinico')
    afirmar('após a conceitualização estabilizar, reaproveita de novo', r5.reaproveitadas === SESSOES,
      `reextraidas=${r5.reextraidas} reaproveitadas=${r5.reaproveitadas}`)

    console.log(`\n${falhou ? '✗ FALHOU' : '✓ TUDO OK'} — economia demonstrada: ${SESSOES} chamada(s) de IA por recálculo repetido`)
  } finally {
    await db.query(`DELETE FROM api_custos    WHERE paciente_id=$1`, [pacienteId]).catch(() => {})
    await db.query(`DELETE FROM objetivos     WHERE paciente_id=$1`, [pacienteId]).catch(() => {})
    await db.query(`DELETE FROM sessao_grafo  WHERE paciente_id=$1`, [pacienteId]).catch(() => {})
    await db.query(`DELETE FROM palavras_chave WHERE paciente_id=$1`, [pacienteId]).catch(() => {})
    await db.query(`DELETE FROM arestas_tema  WHERE paciente_id=$1`, [pacienteId]).catch(() => {})
    await db.query(`DELETE FROM sessoes       WHERE paciente_id=$1`, [pacienteId])
    await db.query(`DELETE FROM pacientes     WHERE id=$1`, [pacienteId])
  }
  await db.end()
  process.exit(falhou ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
