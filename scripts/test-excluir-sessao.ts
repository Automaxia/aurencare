/**
 * Teste de integração de `excluirSessao` — roda contra um Postgres REAL com o
 * schema migrado, porque o que precisa ser provado aqui é SQL: as guardas do
 * DELETE, o estorno de cota e as decisões de renumeração. Typecheck não pega
 * nada disso.
 *
 * Uso (container efêmero, ~30s):
 *
 *   docker run -d --rm --name audere-test-pg \
 *     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=audere_test \
 *     -p 55433:5432 postgres:16-alpine
 *
 *   export DATABASE_URL="postgresql://postgres:test@localhost:55433/audere_test"
 *   npx tsx src/server/db/migrate.ts
 *   npm run test:excluir
 *
 *   docker stop audere-test-pg
 *
 * NÃO carrega .env.local de propósito: este teste INSERE e APAGA linhas, e o
 * .env.local aponta pro banco real. O DATABASE_URL vem explícito, e a trava
 * abaixo recusa qualquer coisa que não seja um banco de teste local.
 */
import { db } from '@/server/db/pool'
import { excluirSessao } from '@/server/services/sessoes'

// Trava de segurança ANTES de qualquer escrita. Um teste destrutivo apontado
// pro banco de produção por engano apagaria prontuário.
function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('✗ DATABASE_URL ausente — veja o cabeçalho deste arquivo.'); process.exit(1) }
  let u: URL
  try { u = new URL(url) } catch { console.error('✗ DATABASE_URL inválida.'); process.exit(1) }
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
  const nomeDeTeste = /test/i.test(u.pathname)
  if (!local || !nomeDeTeste) {
    console.error(`✗ recusando rodar: este teste apaga linhas e só aceita banco de teste local.`)
    console.error(`  host=${u.hostname} banco=${u.pathname.slice(1)} — precisa ser localhost e conter "test" no nome.`)
    process.exit(1)
  }
}

exigirBancoDeTeste()
// `encrypt` deriva a chave na chamada, não no import — definir aqui basta.
process.env.ENCRYPTION_KEY ||= 'chave-de-teste-do-excluir-sessao'

let psicologoId = ''
let pacienteId = ''
let falhas = 0

function checa(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

/** Sufixo único: crp/email são UNIQUE, então rodar duas vezes no mesmo banco colidiria. */
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

async function novaSessao(numero: number, campos: Record<string, any> = {}): Promise<string> {
  const base: Record<string, any> = {
    psicologo_id: psicologoId, paciente_id: pacienteId, numero,
    data_hora: new Date(2026, 0, numero).toISOString(), valor: 100,
    status: 'agendada', pagamento_status: 'pendente', ...campos,
  }
  const cols = Object.keys(base)
  const { rows } = await db.query(
    `INSERT INTO sessoes (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
    cols.map(c => base[c]))
  return rows[0].id
}

async function numeros(): Promise<number[]> {
  const { rows } = await db.query(`SELECT numero FROM sessoes WHERE paciente_id = $1 ORDER BY numero`, [pacienteId])
  return rows.map(r => r.numero)
}

async function limpar() {
  await db.query(`DELETE FROM sessoes WHERE paciente_id = $1`, [pacienteId])
}

async function main() {
  const { encrypt } = await import('@/server/lib/crypto')
  await semear()

  console.log('\n1. Guardas — o que NÃO pode ser excluído')
  {
    const casos: [string, string, string][] = [
      ['assinada',            await novaSessao(1, { status: 'concluida', assinada: true }),               'registro'],
      ['com transcrição',     await novaSessao(2, { status: 'concluida', transcricao_texto: encrypt('oi') }), 'registro'],
      ['com laudo',           await novaSessao(3, { status: 'concluida', laudo: encrypt('laudo') }),      'registro'],
      ['com nota clínica',    await novaSessao(4, { status: 'concluida', nota_clinica: encrypt('nota') }), 'registro'],
      ['com resumo curto',    await novaSessao(5, { status: 'concluida', resumo_curto: encrypt('r') }),   'registro'],
      ['em curso',            await novaSessao(6, { status: 'em_curso' }),                                'em_curso'],
      ['paga',                await novaSessao(7, { pagamento_status: 'pago' }),                          'paga'],
      ['com cobrança aberta', await novaSessao(8, { pagarme_order_id: 'or_1', pagamento_status: 'pendente' }), 'cobranca'],
    ]
    for (const [nome, id, motivo] of casos) {
      const r = await excluirSessao(psicologoId, id)
      checa(`bloqueia ${nome}`, !r.ok && r.motivo === motivo, r.ok ? 'excluiu!' : `motivo=${r.motivo}`)
    }
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`, [pacienteId])
    checa('nenhuma linha sumiu', rows[0].n === casos.length, `restaram ${rows[0].n}`)
    await limpar()
  }

  console.log('\n2. Concluída vazia — o caso que motivou tudo')
  {
    const vazia = await novaSessao(1, { status: 'concluida' })
    const r = await excluirSessao(psicologoId, vazia)
    checa('exclui concluída sem registro', r.ok === true, r.ok ? '' : `motivo=${(r as any).motivo}`)
    checa('linha sumiu', (await numeros()).length === 0)
    await limpar()
  }

  console.log('\n3. Isolamento entre psicólogos (IDOR)')
  {
    const { rows: [outro] } = await db.query(
      `INSERT INTO psicologos (nome, crp, email, senha_hash) VALUES ('Outro', $1, $2, 'x') RETURNING id`,
      [`CRP-${tag}-b`, `${tag}-b@teste.local`])
    const alheia = await novaSessao(1)
    const r = await excluirSessao(outro.id, alheia)
    checa('psicólogo alheio não exclui', !r.ok && r.motivo === 'nao_encontrada')
    checa('linha continua lá', (await numeros()).length === 1)
    await limpar()
  }

  console.log('\n4. Estorno da cota de IA')
  {
    const comp = new Date().toISOString().slice(0, 7)
    await db.query(
      `INSERT INTO uso_mensal (psicologo_id, competencia, sessoes_ia) VALUES ($1, $2, 3)
       ON CONFLICT (psicologo_id, competencia) DO UPDATE SET sessoes_ia = 3`, [psicologoId, comp])
    const lerCota = async () => (await db.query<{ sessoes_ia: number }>(
      `SELECT sessoes_ia FROM uso_mensal WHERE psicologo_id = $1 AND competencia = $2`, [psicologoId, comp])).rows[0]?.sessoes_ia

    await excluirSessao(psicologoId, await novaSessao(1, { status: 'concluida', ia_contabilizada: true }))
    checa('cota estornada (3 → 2)', await lerCota() === 2, `ficou ${await lerCota()}`)

    await excluirSessao(psicologoId, await novaSessao(2, { status: 'concluida', ia_contabilizada: false }))
    checa('não estorna o que não contou (segue 2)', await lerCota() === 2, `ficou ${await lerCota()}`)
    await limpar()
  }

  console.log('\n5. Colunas NULL (assinada/status/pagamento_status são nullable no schema)')
  {
    const nula = await novaSessao(1, { status: 'concluida' })
    await db.query(`UPDATE sessoes SET assinada = NULL, pagamento_status = NULL WHERE id = $1`, [nula])
    const r = await excluirSessao(psicologoId, nula)
    checa('exclui com assinada/pagamento_status NULL', r.ok === true, r.ok ? '' : `motivo=${(r as any).motivo}`)
    await limpar()

    await novaSessao(1, { status: 'concluida' })
    const meio = await novaSessao(2, { status: 'concluida' })
    const seg = await novaSessao(3)
    await db.query(`UPDATE sessoes SET assinada = NULL WHERE id = $1`, [seg])
    const r2 = await excluirSessao(psicologoId, meio)
    checa('renumera com assinada NULL à frente',
      JSON.stringify(await numeros()) === '[1,2]' && r2.ok && r2.renumeradas === 1,
      `numeros=${JSON.stringify(await numeros())}`)
    await limpar()
  }

  console.log('\n6. Renumeração')
  {
    // Compacta: nada à frente tem documento com o número escrito dentro.
    await novaSessao(1, { status: 'concluida', assinada: true })
    const meio = await novaSessao(2, { status: 'concluida' })
    await novaSessao(3); await novaSessao(4)
    const r = await excluirSessao(psicologoId, meio)
    checa('compacta quando nada à frente tem documento',
      JSON.stringify(await numeros()) === '[1,2,3]' && r.ok && r.renumeradas === 2,
      `numeros=${JSON.stringify(await numeros())} renumeradas=${r.ok ? r.renumeradas : '-'}`)
    await limpar()

    // Preserva o buraco: renumerar desalinharia o laudo assinado, que diz "#3".
    await novaSessao(1, { status: 'concluida', assinada: true })
    const meio2 = await novaSessao(2, { status: 'concluida' })
    await novaSessao(3, { status: 'concluida', assinada: true })
    const r2 = await excluirSessao(psicologoId, meio2)
    checa('preserva buraco quando há laudo assinado à frente',
      JSON.stringify(await numeros()) === '[1,3]' && r2.ok && r2.renumeradas === 0,
      `numeros=${JSON.stringify(await numeros())}`)
    await limpar()

    // Idem pra rascunho: o resumo curto também nasce com o número no texto.
    await novaSessao(1, { status: 'concluida' })
    const meio3 = await novaSessao(2, { status: 'concluida' })
    await novaSessao(3, { status: 'concluida', resumo_curto: encrypt('rascunho') })
    const r3 = await excluirSessao(psicologoId, meio3)
    checa('preserva buraco quando há resumo gerado à frente',
      JSON.stringify(await numeros()) === '[1,3]' && r3.ok && r3.renumeradas === 0,
      `numeros=${JSON.stringify(await numeros())}`)
    await limpar()

    // A última nunca deixou buraco: o próximo numero é MAX+1, que volta a ser o dela.
    await novaSessao(1, { status: 'concluida', assinada: true })
    const ultima = await novaSessao(2, { status: 'concluida' })
    const r4 = await excluirSessao(psicologoId, ultima)
    const { rows: prox } = await db.query<{ n: number }>(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM sessoes WHERE paciente_id = $1`, [pacienteId])
    checa('excluir a última não deixa buraco e devolve o número',
      JSON.stringify(await numeros()) === '[1]' && prox[0].n === 2 && r4.ok && r4.renumeradas === 0,
      `proximo=${prox[0].n}`)
    await limpar()
  }

  // psicologos ON DELETE CASCADE leva paciente e sessões junto.
  await db.query(`DELETE FROM psicologos WHERE crp LIKE $1`, [`CRP-${tag}%`])

  console.log(falhas === 0 ? '\n✓ tudo passou' : `\n✗ ${falhas} falha(s)`)
  await db.end()
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(async e => { console.error(e); await db.end().catch(() => {}); process.exit(1) })
