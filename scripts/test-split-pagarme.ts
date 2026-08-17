/**
 * Teste do split de sessão (comissão da plataforma + líquido do psicólogo).
 *
 * NÃO faz chamada de rede nem gasta nada — valida só a montagem das fatias.
 *
 *   npm run test:split
 *
 * O invariante que mais importa: a soma das fatias tem de bater EXATAMENTE com
 * o valor da order. Um centavo de diferença e a Pagar.me rejeita a cobrança.
 */
process.env.PAGARME_RECIPIENT_PLATAFORMA ||= 'rp_plataforma_teste'

const RP = 'rp_psicologo_teste'
let falhou = false

function afirmar(descricao: string, condicao: boolean, detalhe: string) {
  console.log(`${condicao ? '✓' : '✗'} ${descricao} — ${detalhe}`)
  if (!condicao) falhou = true
}

const brl = (c: number) => `R$ ${(c / 100).toFixed(2)}`

async function main() {
  // import dinâmico: a env da plataforma precisa existir ANTES de env.ts ser lido
  const { montarSplitSessao } = await import('@/server/lib/pagarme')
  const { COMISSAO_SESSAO_PCT } = await import('@/server/lib/planos')

  console.log(`Comissão configurada: ${(COMISSAO_SESSAO_PCT * 100).toFixed(1)}%\n`)

  // ── Valores típicos + casos de arredondamento ──────────────────────────
  for (const valor of [20000, 15000, 9999, 12345, 100, 33333]) {
    const r = montarSplitSessao(valor, RP, 'teste')
    if (!r) { afirmar(`split de ${brl(valor)}`, false, 'retornou null (esperado split)'); continue }

    const [psi, plat] = r.split
    const soma = psi.amount + plat.amount
    const esperado = Math.round(valor * COMISSAO_SESSAO_PCT)

    afirmar(
      `${brl(valor)} → psicólogo ${brl(psi.amount)} + plataforma ${brl(plat.amount)}`,
      soma === valor && plat.amount === esperado,
      `soma=${brl(soma)} (deve ser ${brl(valor)}) · comissão esperada ${brl(esperado)}`,
    )
  }

  // ── Quem paga o quê ────────────────────────────────────────────────────
  const r = montarSplitSessao(20000, RP, 'teste')!
  const [psi, plat] = r.split
  afirmar('psicólogo é quem paga a taxa da Pagar.me', psi.options.charge_processing_fee === true,
    `charge_processing_fee=${psi.options.charge_processing_fee}`)
  afirmar('comissão da plataforma NÃO paga taxa de processamento', plat.options.charge_processing_fee === false,
    `charge_processing_fee=${plat.options.charge_processing_fee}`)
  afirmar('psicólogo responde por chargeback', psi.options.liable === true && plat.options.liable === false,
    `liable psicólogo=${psi.options.liable} plataforma=${plat.options.liable}`)
  afirmar('psicólogo absorve o arredondamento', psi.options.charge_remainder_fee === true,
    `charge_remainder_fee=${psi.options.charge_remainder_fee}`)
  afirmar('fatias endereçadas aos recipients certos', psi.recipient_id === RP && plat.recipient_id === 'rp_plataforma_teste',
    `${psi.recipient_id} / ${plat.recipient_id}`)
  afirmar('tipo é flat (valor exato em centavos)', psi.type === 'flat' && plat.type === 'flat',
    `${psi.type}/${plat.type}`)

  // ── Degradação segura ──────────────────────────────────────────────────
  afirmar('psicólogo sem recipient → sem split (não quebra a cobrança)',
    montarSplitSessao(20000, null, 'teste') === null, 'retornou null')
  afirmar('valor baixo demais → sem split',
    montarSplitSessao(0, RP, 'teste') === null, 'retornou null')

  console.log(`\n${falhou ? '✗ FALHOU' : '✓ TUDO OK'}`)
  process.exit(falhou ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
