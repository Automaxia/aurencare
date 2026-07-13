/**
 * Teste de integração da instrumentação de custo (Tarefa 1c).
 * Roda contra o banco configurado em DATABASE_URL. Usa modelo='__test__' como
 * marcador e limpa tudo ao final. Não faz chamada de IA real — exercita o
 * contrato de gravação (registrarCustoLlm / registrarCustoAssemblyEstimado).
 *
 *   npm run test:custos
 * (equivale a: NODE_OPTIONS='--conditions=react-server' tsx --env-file=.env.local
 *  scripts/test-custos-instrumentacao.ts — a flag react-server neutraliza o
 *  `server-only` importado por pool.ts/custos.ts fora do runtime do Next.)
 */
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { registrarCustoLlm, registrarCustoAssemblyEstimado, naturezaDeOperacao } from '@/server/services/custos'

const MARCADOR = '__test__'
let falhas = 0
function ok(cond: boolean, msg: string) { console.log(`${cond ? '✓' : '✗ FALHOU'} ${msg}`); if (!cond) falhas++ }

async function main() {
  const psi = randomUUID(), sess = randomUUID(), pac = randomUUID()

  // 1. Colunas novas existem
  const { rows: cols } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='api_custos'`)
  const nomes = new Set(cols.map(c => c.column_name))
  for (const c of ['paciente_id', 'natureza', 'escopo_recalculo', 'custo_brl'])
    ok(nomes.has(c), `coluna ${c} existe`)

  // 2. LLM ao vivo: psicologo_id + operacao + natureza + custo_brl preenchidos
  await registrarCustoLlm({ provider: 'openai', operacao: 'ia.tom', modelo: MARCADOR,
    tokensEntrada: 1000, tokensSaida: 200, psicologoId: psi, sessaoId: sess, pacienteId: pac })
  const { rows: r1 } = await db.query(
    `SELECT psicologo_id, operacao, natureza, sessao_id, paciente_id, custo_usd, custo_brl
       FROM api_custos WHERE modelo=$1 AND operacao='ia.tom'`, [MARCADOR])
  ok(r1.length === 1, 'linha ia.tom gravada')
  ok(r1[0]?.psicologo_id === psi, 'ia.tom tem psicologo_id')
  ok(r1[0]?.natureza === 'ao_vivo', `ia.tom natureza=ao_vivo (got ${r1[0]?.natureza})`)
  ok(Number(r1[0]?.custo_brl) > 0 && Math.abs(Number(r1[0]?.custo_brl) - Number(r1[0]?.custo_usd) * 5.4) < 1e-4, 'custo_brl = custo_usd * 5.40')

  // 3. Laudo (natureza=sessao) tem sessao_id
  await registrarCustoLlm({ provider: 'anthropic', operacao: 'anthropic.resumo', modelo: MARCADOR,
    tokensEntrada: 2000, tokensSaida: 800, psicologoId: psi, sessaoId: sess, pacienteId: pac })
  const { rows: r2 } = await db.query(
    `SELECT natureza, sessao_id FROM api_custos WHERE modelo=$1 AND operacao='anthropic.resumo'`, [MARCADOR])
  ok(r2[0]?.natureza === 'sessao', 'laudo natureza=sessao')
  ok(!!r2[0]?.sessao_id, 'natureza=sessao tem sessao_id')

  // 4. Transcrição estimada (natureza=sessao)
  await registrarCustoAssemblyEstimado({ segundos: 3000, psicologoId: psi, sessaoId: sess, pacienteId: pac })
  const { rows: r3 } = await db.query(
    `SELECT natureza, psicologo_id, sessao_id FROM api_custos WHERE provider='assemblyai' AND sessao_id=$1`, [sess])
  ok(r3[0]?.natureza === 'sessao' && !!r3[0]?.psicologo_id && !!r3[0]?.sessao_id, 'transcrição: natureza=sessao + ids preenchidos')

  // 5. Fail-loud: sem psicologo_id NÃO grava linha órfã
  const antes = (await db.query(`SELECT count(*)::int n FROM api_custos WHERE modelo=$1`, ['__orfao__'])).rows[0].n
  try {
    await registrarCustoLlm({ provider: 'openai', operacao: 'ia.tom', modelo: '__orfao__',
      tokensEntrada: 10, tokensSaida: 10, psicologoId: undefined as any })
  } catch { /* dev: throw esperado, capturado */ }
  const depois = (await db.query(`SELECT count(*)::int n FROM api_custos WHERE modelo=$1`, ['__orfao__'])).rows[0].n
  ok(depois === antes, 'custo órfão (sem psicologo_id) não gera linha')

  // 6. Mapa de natureza — sanidade
  ok(naturezaDeOperacao('temas.grafo.clinico') === 'fundo', 'temas.grafo.clinico → fundo')
  ok(naturezaDeOperacao('chat.temas') === 'outros', 'chat.temas → outros')

  // Limpeza
  await db.query(`DELETE FROM api_custos WHERE modelo IN ($1,'__orfao__') OR sessao_id=$2`, [MARCADOR, sess])

  console.log(falhas === 0 ? '\n✅ TODOS OS TESTES PASSARAM' : `\n❌ ${falhas} teste(s) falharam`)
  await db.end()
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
