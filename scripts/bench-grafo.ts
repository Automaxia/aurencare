/**
 * Benchmark da curva de custo do grafo de temas (Tarefa 3).
 *
 * ⚠️ FAZ CHAMADAS DE IA REAIS E PAGAS. Rode contra um ambiente de TESTE/STAGING,
 * NUNCA produção. Cria um paciente sintético (demo=TRUE) por tamanho de histórico,
 * dispara recalcularGrafo, mede tokens/custo/latência via api_custos e limpa tudo.
 *
 *   npm run bench:grafo        (contra .env de um ambiente de TESTE/staging)
 *
 * Requer: DATABASE_URL de teste + OPENAI_API_KEY (ou ANTHROPIC) configurada.
 * Lê a atribuição de custo de api_custos (instrumentação da Tarefa 1) — por isso
 * este benchmark só é confiável DEPOIS da migration 038 aplicada.
 */
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { encrypt } from '@/server/lib/crypto'
import { recalcularGrafo } from '@/server/services/temas'

const TAMANHOS = [5, 10, 20, 40, 80]

/** Transcrição sintética realista: ~N turnos de fala do paciente (prefixo C:). */
function transcricaoSintetica(numeroSessao: number): string {
  const temas = [
    'ansiedade no trabalho', 'a relação com minha mãe', 'dificuldade de dormir',
    'medo de falhar', 'sensação de estar sobrecarregado', 'culpa por descansar',
    'conflito com meu parceiro', 'autocrítica', 'evitar situações sociais',
  ]
  const linhas: string[] = []
  for (let i = 0; i < 24; i++) {
    const t = temas[(numeroSessao + i) % temas.length]
    linhas.push(`P: E como foi essa semana com ${t}?`)
    linhas.push(`C: Essa semana ${t} apareceu de novo. Eu percebi que quando isso acontece eu tendo a me fechar, e aí fico ruminando sobre ${temas[(i * 3) % temas.length]}. Tentei respirar como a gente conversou, ajudou um pouco mas não resolveu. Ainda sinto no corpo, aquele aperto no peito.`)
  }
  return linhas.join('\n')
}

async function criarPacienteSintetico(psicologoId: string, n: number): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO pacientes (psicologo_id, nome, telefone, demo, status)
     VALUES ($1, $2, $3, TRUE, 'ativo') RETURNING id`,
    [psicologoId, `__bench_${n}`, `bench${Date.now() % 1e8}`],
  )
  const pacienteId = rows[0].id
  const base = Date.now() - n * 7 * 24 * 3600 * 1000
  for (let i = 1; i <= n; i++) {
    await db.query(
      `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora, status, assinada, valor, pagamento_status, transcricao_texto)
       VALUES ($1,$2,$3,$4,'concluida',TRUE,0,'isento',$5)`,
      [psicologoId, pacienteId, i, new Date(base + i * 7 * 24 * 3600 * 1000).toISOString(), encrypt(transcricaoSintetica(i))],
    )
  }
  return pacienteId
}

/**
 * O registro de custo em `llm.ts` é fire-and-forget (`import().then(...)` NÃO
 * aguardado, pra não atrasar a resposta ao psicólogo). Quando `recalcularGrafo`
 * retorna, as últimas linhas de `api_custos` ainda podem estar em voo — somar
 * na hora subestima tokens/custo, e pior quanto maior o n. Espera a contagem
 * atingir o esperado E parar de crescer antes de medir.
 */
async function aguardarCustosGravados(pacienteId: string, esperadas: number): Promise<void> {
  const LIMITE_MS = 20_000
  const t0 = Date.now()
  let anterior = -1
  while (Date.now() - t0 < LIMITE_MS) {
    const { rows } = await db.query<{ n: string }>(
      `SELECT COUNT(*) n FROM api_custos WHERE paciente_id=$1 AND operacao LIKE 'temas.grafo%'`, [pacienteId])
    const n = Number(rows[0].n)
    if (n >= esperadas && n === anterior) return // chegou tudo e estabilizou
    anterior = n
    await new Promise(r => setTimeout(r, 400))
  }
  console.warn(`[bench] custos não estabilizaram em ${LIMITE_MS}ms (esperadas ${esperadas}, vistas ${anterior}) — número pode estar subestimado`)
}

async function medir(pacienteId: string, sessoesEsperadas: number) {
  // zera o rastro de custo desse paciente antes de medir
  await db.query(`DELETE FROM api_custos WHERE paciente_id=$1`, [pacienteId])
  const t0 = Date.now()
  const r = await recalcularGrafo(pacienteId, 'clinico')
  const latenciaMs = Date.now() - t0
  await aguardarCustosGravados(pacienteId, sessoesEsperadas)
  const { rows } = await db.query<{ tin: string; tout: string; brl: string; chamadas: string }>(
    `SELECT COALESCE(SUM(tokens_entrada),0) tin, COALESCE(SUM(tokens_saida),0) tout,
            COALESCE(SUM(custo_brl),0) brl, COUNT(*) chamadas
       FROM api_custos WHERE paciente_id=$1 AND operacao LIKE 'temas.grafo%'`, [pacienteId])
  return { sessoes: r.sessoes, chamadas: Number(rows[0].chamadas), tin: Number(rows[0].tin),
           tout: Number(rows[0].tout), brl: Number(rows[0].brl), latenciaMs }
}

async function main() {
  const psi = (await db.query<{ id: string }>(`SELECT id FROM psicologos ORDER BY created_at LIMIT 1`)).rows[0]
  if (!psi) { console.error('Sem psicólogo no banco — rode o seed antes.'); process.exit(1) }

  const linhas: any[] = []
  for (const n of TAMANHOS) {
    const pid = await criarPacienteSintetico(psi.id, n)
    try {
      const m = await medir(pid, n)
      linhas.push({ n, ...m, brlPorSessao: +(m.brl / n).toFixed(4) })
      console.log(`n=${n}: ${m.chamadas} chamadas · ${m.tin}+${m.tout} tok · R$ ${m.brl.toFixed(4)} · ${m.latenciaMs}ms`)
    } finally {
      await db.query(`DELETE FROM api_custos WHERE paciente_id=$1`, [pid])
      await db.query(`DELETE FROM sessao_grafo WHERE paciente_id=$1`, [pid]).catch(() => {})
      await db.query(`DELETE FROM palavras_chave WHERE paciente_id=$1`, [pid]).catch(() => {})
      await db.query(`DELETE FROM sessoes WHERE paciente_id=$1`, [pid])
      await db.query(`DELETE FROM pacientes WHERE id=$1`, [pid])
    }
  }

  console.log('\n| sessões | chamadas | custo R$ | R$/sessão | latência ms |')
  console.log('|--:|--:|--:|--:|--:|')
  for (const l of linhas) console.log(`| ${l.n} | ${l.chamadas} | ${l.brl.toFixed(4)} | ${l.brlPorSessao} | ${l.latenciaMs} |`)

  // Verdito de complexidade: razão custo(80)/custo(5) — ~16 = O(n) linear, ~256 = O(n²)
  const menor = linhas[0], maior = linhas[linhas.length - 1]
  const razaoCusto = maior.brl / menor.brl, razaoN = maior.n / menor.n
  console.log(`\nRazão custo(${maior.n})/custo(${menor.n}) = ${razaoCusto.toFixed(1)}× (n cresceu ${razaoN}×)`)
  console.log(razaoCusto < razaoN * 1.4 ? '→ O(n) LINEAR (custo escala com nº de sessões)'
    : razaoCusto > razaoN * razaoN * 0.6 ? '→ O(n²) QUADRÁTICO (alerta!)' : '→ super-linear, investigar')
  await db.end()
}
main().catch(e => { console.error(e); process.exit(1) })
