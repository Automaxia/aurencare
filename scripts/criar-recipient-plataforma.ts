/**
 * Cria o Recipient da PLATAFORMA na Pagar.me — destino da comissão por sessão
 * no split (`PAGARME_RECIPIENT_PLATAFORMA`).
 *
 *   npm run pagarme:recipient-plataforma
 *
 * ⚠️ CRIA UM OBJETO REAL na conta Pagar.me correspondente à `PAGARME_API_KEY`
 * carregada. Com `sk_test_` cria no sandbox; com `sk_live_` cria em PRODUÇÃO.
 * O script mostra o ambiente detectado e exige confirmação (`--sim`) no live.
 *
 * Recipients são **por ambiente**: o do sandbox não existe no live. Este script
 * será rodado de novo no go-live, com a chave de produção.
 *
 * Passa pela MESMA função que o onboarding dos psicólogos usa
 * (`criarRecipient`), então serve também como teste desse caminho.
 */
import { criarRecipient, type RecipientInput } from '@/server/lib/pagarmeRecipient'

/** Dados da empresa (CNPJ DF, 38.154.192/0001-63). */
const AUTOMAXIA: RecipientInput = {
  tipoPessoa: 'PJ',
  documento: '38154192000163',
  razaoSocial: 'AUTOMAXIA INTELIGENCIA PARA NEGOCIOS LTDA',
  email: 'wesleyromualdo@gmail.com',
  telefone: '6199423445',
  dataNascimento: '2020-08-19',        // founding_date (abertura da empresa)
  // `rendaCentavos` é MENSAL — a lib multiplica por 12 para `annual_revenue`.
  // R$ 30.000/mês → R$ 360.000/ano, teto do porte ME declarado no cartão CNPJ.
  // É campo de KYC declaratório; ajuste se o valor real for outro.
  rendaCentavos: 3_000_000,
  banco: {
    codigo: '237',                     // Bradesco
    agencia: '1469',
    agenciaDv: null,
    conta: '021141',
    contaDv: '9',
    tipo: 'corrente',
    titularNome: 'AUTOMAXIA INTELIGENCIA PARA NEGOCIOS LTDA',
    titularDocumento: '38154192000163',
  },
}

async function main() {
  const key = process.env.PAGARME_API_KEY ?? ''
  const ambiente = key.startsWith('sk_live_') ? 'PRODUÇÃO' : key.startsWith('sk_test_') ? 'sandbox' : 'desconhecido'

  console.log(`Ambiente Pagar.me: ${ambiente} (${key.slice(0, 8)}…)`)
  console.log(`Empresa: ${AUTOMAXIA.razaoSocial}`)
  console.log(`Banco: ${AUTOMAXIA.banco.codigo} ag ${AUTOMAXIA.banco.agencia} cc ${AUTOMAXIA.banco.conta}-${AUTOMAXIA.banco.contaDv}\n`)

  if (ambiente === 'desconhecido') {
    console.error('PAGARME_API_KEY ausente ou em formato inesperado — abortando.')
    process.exit(1)
  }
  if (ambiente === 'PRODUÇÃO' && !process.argv.includes('--sim')) {
    console.error('Recusando criar recipient em PRODUÇÃO sem `--sim`.')
    console.error('Confira que é isso mesmo e rode: npm run pagarme:recipient-plataforma -- --sim')
    process.exit(1)
  }

  const r = await criarRecipient(AUTOMAXIA)

  console.log(`\n✓ Recipient criado: ${r.recipientId}  (status=${r.status})`)
  console.log('\nDefina no ambiente:')
  console.log(`  PAGARME_RECIPIENT_PLATAFORMA=${r.recipientId}`)
  console.log('\nNo cluster:')
  console.log(`  kubectl patch secret aurencare-secrets -n aurencare --type merge \\`)
  console.log(`    -p '{"stringData":{"PAGARME_RECIPIENT_PLATAFORMA":"${r.recipientId}"}}'`)
  console.log('\nSem essa env, a cobrança sai SEM split e o valor inteiro fica na conta-mãe.')
}

main().catch(e => { console.error(e); process.exit(1) })
