/**
 * Teste de integração da numeração de sessões pela DATA (`renumerarPorData` e
 * migration 049) — roda contra um Postgres REAL com o schema migrado, porque a
 * regra toda é SQL.
 *
 * Uso (container efêmero, ~30s):
 *
 *   docker run -d --rm --name audere-test-pg \
 *     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=audere_test \
 *     -p 55433:5432 postgres:16-alpine
 *
 *   export DATABASE_URL="postgresql://postgres:test@localhost:55433/audere_test"
 *   npx tsx src/server/db/migrate.ts
 *   npm run test:numeracao
 *
 *   docker stop audere-test-pg
 *
 * Mesma trava do test-excluir-sessao: só aceita banco local com "test" no nome.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/server/db/pool'
import { criarSessao, criarSerie, reagendarSessao } from '@/server/services/sessoes'

function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('✗ DATABASE_URL ausente — veja o cabeçalho deste arquivo.'); process.exit(1) }
  let u: URL
  try { u = new URL(url) } catch { console.error('✗ DATABASE_URL inválida.'); process.exit(1) }
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
  if (!local || !/test/i.test(u.pathname)) {
    console.error(`✗ recusando rodar: este teste escreve linhas e só aceita banco de teste local.`)
    process.exit(1)
  }
}

exigirBancoDeTeste()
process.env.ENCRYPTION_KEY ||= 'chave-de-teste-da-numeracao'

let psicologoId = ''
let pacienteId = ''
let falhas = 0

function checa(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

const tag = `t${Date.now().toString(36)}`

async function semear() {
  const { rows: [p] } = await db.query(
    `INSERT INTO psicologos (nome, crp, email, senha_hash)
     VALUES ('Teste', $1, $2, 'x') RETURNING id`, [`CRP-${tag}`, `${tag}@teste.local`])
  psicologoId = p.id
  const { rows: [pac] } = await db.query(
    `INSERT INTO pacientes (psicologo_id, nome, telefone) VALUES ($1,'Paciente','11999999999') RETURNING id`,
    [psicologoId])
  pacienteId = pac.id
}

/** Dia `d` de fevereiro/2027 às 10h (futuro, sem colisão de horário). */
const dia = (d: number, h = 10) => new Date(Date.UTC(2027, 1, d, h + 3)).toISOString()

async function inserir(numero: number, dataHora: string, campos: Record<string, any> = {}): Promise<string> {
  const base: Record<string, any> = {
    psicologo_id: psicologoId, paciente_id: pacienteId, numero, data_hora: dataHora,
    valor: 0, status: 'confirmada', pagamento_status: 'isento', ...campos,
  }
  const cols = Object.keys(base)
  const { rows } = await db.query(
    `INSERT INTO sessoes (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
    cols.map(c => base[c]))
  return rows[0].id
}

/** Números na ordem da agenda (por data). */
async function sequencia(): Promise<number[]> {
  const { rows } = await db.query(
    `SELECT numero FROM sessoes WHERE paciente_id = $1 ORDER BY data_hora, created_at, id`, [pacienteId])
  return rows.map(r => r.numero)
}

async function numeroDe(id: string): Promise<number> {
  const { rows } = await db.query(`SELECT numero FROM sessoes WHERE id = $1`, [id])
  return rows[0].numero
}

async function limpar() {
  await db.query(`DELETE FROM sessoes WHERE paciente_id = $1`, [pacienteId])
}

const igual = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b)

async function main() {
  const { encrypt } = await import('@/server/lib/crypto')
  await semear()

  console.log('\n1. Pacote de 4 + sessão extra entre a #2 e a #3 (o caso relatado)')
  {
    await criarSerie({
      psicologoId, pacienteId, primeiraSessaoIso: dia(1), frequencia: 'semanal',
      quantidade: 4, valor: 0,
    })
    checa('pacote nasce #1–#4', igual(await sequencia(), [1, 2, 3, 4]), JSON.stringify(await sequencia()))
    const extra = await criarSessao({ psicologoId, pacienteId, dataHora: dia(11), valor: 0 })
    checa('extra vira #3', extra.numero === 3, `numero=${extra.numero}`)
    checa('seguintes sobem (#4, #5)', igual(await sequencia(), [1, 2, 3, 4, 5]), JSON.stringify(await sequencia()))
    await limpar()
  }

  console.log('\n2. Sessões com documento não mudam de número')
  {
    await inserir(1, dia(1), { status: 'concluida', assinada: true })
    await inserir(2, dia(8), { status: 'concluida', laudo: encrypt('laudo da #2') })
    const s3 = await inserir(3, dia(15))
    const s4 = await inserir(4, dia(22))
    const extra = await criarSessao({ psicologoId, pacienteId, dataHora: dia(10), valor: 0 })
    checa('extra depois das documentadas vira #3', extra.numero === 3, `numero=${extra.numero}`)
    checa('futuras sobem', (await numeroDe(s3)) === 4 && (await numeroDe(s4)) === 5,
      JSON.stringify(await sequencia()))
    await limpar()

    // Registro retroativo ANTES de uma sessão assinada: a assinada fica como está.
    const a1 = await inserir(1, dia(1), { status: 'concluida', assinada: true })
    const a2 = await inserir(2, dia(8), { status: 'concluida', resumo_curto: encrypt('r') })
    await criarSessao({ psicologoId, pacienteId, dataHora: dia(4), valor: 0 })
    checa('documentadas mantêm #1 e #2', (await numeroDe(a1)) === 1 && (await numeroDe(a2)) === 2,
      JSON.stringify(await sequencia()))
    await limpar()
  }

  console.log('\n3. Remarcar reordena')
  {
    const s1 = await inserir(1, dia(1))
    const s2 = await inserir(2, dia(8))
    const s3 = await inserir(3, dia(15))
    const r = await reagendarSessao(psicologoId, s3, { dataHora: dia(4) })
    checa('remarcou', r.ok)
    checa('a remarcada vira #2 e a antiga #2 vira #3',
      (await numeroDe(s1)) === 1 && (await numeroDe(s3)) === 2 && (await numeroDe(s2)) === 3,
      JSON.stringify(await sequencia()))
    // Só duração: não mexe em número.
    await reagendarSessao(psicologoId, s1, { duracaoMin: 30 })
    checa('mudar só a duração não renumera', igual(await sequencia(), [1, 2, 3]))
    await limpar()
  }

  console.log('\n4. Migration 049 corrige dados existentes (e é idempotente)')
  {
    const sql = readFileSync(join(process.cwd(), 'src/server/db/migrations/049_sessoes_numero_por_data.sql'), 'utf8')
    // Estado do bug: pacote #1–#4 + extra criada depois (#5) entre a #2 e a #3,
    // com a #1 assinada.
    const m1 = await inserir(1, dia(1), { status: 'concluida', assinada: true })
    await inserir(2, dia(8))
    const extra = await inserir(5, dia(11))
    await inserir(3, dia(15))
    await inserir(4, dia(22))
    await db.query(sql)
    checa('numeração pela data', igual(await sequencia(), [1, 2, 3, 4, 5]), JSON.stringify(await sequencia()))
    checa('extra virou #3', (await numeroDe(extra)) === 3)
    checa('assinada continua #1', (await numeroDe(m1)) === 1)
    const { rowCount } = await db.query(sql)
    checa('rodar de novo não muda nada', rowCount === 0, `rowCount=${rowCount}`)
    await limpar()
  }

  await db.query(`DELETE FROM psicologos WHERE crp LIKE $1`, [`CRP-${tag}%`])

  console.log(falhas === 0 ? '\n✓ tudo passou' : `\n✗ ${falhas} falha(s)`)
  await db.end()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async e => { console.error(e); await db.end().catch(() => {}); process.exit(1) })
