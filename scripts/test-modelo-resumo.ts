/**
 * Teste de integração do modelo de resumo personalizado (Pro) contra Postgres
 * REAL migrado. Uso: mesmo container do test-excluir-sessao.ts, depois
 * `npm run test:modelo-resumo`. Só aceita banco local com "test" no nome.
 */
import { db } from '@/server/db/pool'
import { salvarModeloResumo, modeloResumoAtivo, lerModeloResumo } from '@/server/services/modeloResumo'

const url = new URL(process.env.DATABASE_URL ?? 'x://invalid')
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || !/test/i.test(url.pathname)) {
  console.error('✗ recusando rodar: só banco de teste local.'); process.exit(1)
}

let falhas = 0
const checa = (nome: string, ok: boolean, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${nome}${d ? ` — ${d}` : ''}`); if (!ok) falhas++ }
const tag = `t${Date.now().toString(36)}`
const MODELO = '## Queixa\nUm parágrafo.\n\n## Plano\nLista de combinados para a próxima sessão.'

async function main() {
  const { rows: [p] } = await db.query(
    `INSERT INTO psicologos (nome, crp, email, senha_hash) VALUES ('Dra Teste', $1, $2, 'x') RETURNING id`,
    [`CRP-${tag}`, `${tag}@teste.local`])
  const id = p.id as string
  const plano = (pl: string, expira: string | null = null) =>
    db.query(`UPDATE psicologos SET plano = $2, plano_expira_em = $3 WHERE id = $1`, [id, pl, expira])

  await plano('free')
  let r = await salvarModeloResumo(id, MODELO)
  checa('free não salva modelo', !r.ok)

  await plano('pro')
  r = await salvarModeloResumo(id, 'curto')
  checa('recusa modelo curto demais', !r.ok)
  r = await salvarModeloResumo(id, MODELO)
  checa('pro salva modelo', r.ok)
  checa('pro usa o modelo', (await modeloResumoAtivo(id)) === MODELO)

  await plano('pro', new Date(Date.now() - 86_400_000).toISOString())   // cortesia vencida → free efetivo
  checa('plano vencido volta ao padrão', (await modeloResumoAtivo(id)) === null)
  checa('…sem apagar o texto salvo', (await lerModeloResumo(id)).texto === MODELO)

  await plano('free')
  r = await salvarModeloResumo(id, '')
  checa('qualquer plano pode voltar ao padrão', r.ok && (await lerModeloResumo(id)).texto === null)

  await db.query(`DELETE FROM psicologos WHERE id = $1`, [id])
  await db.end()
  console.log(falhas ? `\n✗ ${falhas} falha(s)` : '\n✓ tudo certo')
  process.exit(falhas ? 1 : 0)
}
main().catch(async e => { console.error(e); await db.end().catch(() => {}); process.exit(1) })
