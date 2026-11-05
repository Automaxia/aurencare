/**
 * Testes unitários da camada de pagamentos (sem rede, sem banco).
 *
 *   npm run test:pagamentos
 *
 * Cobre: split sobre o líquido (D-01), situação cadastral do Asaas,
 * normalização de cada evento do webhook (payloads reais do spike de
 * 04/11/2026), token do webhook e a tabela única de taxas.
 */
let falhou = false
function ok(descricao: string, cond: boolean, detalhe = '') {
  console.log(`${cond ? '✓' : '✗'} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!cond) falhou = true
}

async function main() {
  const { splitSobreLiquido, paraCentavos, paraReais } = await import('@/server/lib/pagamentos/split')
  const { situacaoDeStatus } = await import('@/server/lib/pagamentos/asaas/situacao')
  const { normalizarEventoAsaas, tokenConfere } = await import('@/server/lib/pagamentos/asaas/webhook')
  const { taxaGatewayReais } = await import('@/server/lib/pagamentos/taxas')
  const { refSessao, sessaoDeRef } = await import('@/server/lib/pagamentos/asaas/ref')

  console.log('── split sobre o líquido (D-01) ──')
  // Casos reais do spike: R$ 10 PIX (líquido 9,01) e 3× R$ 100 cartão (líquido 292,05).
  const a = splitSobreLiquido(1000, 901)
  ok('R$ 10 PIX → psicólogo 8,76 / raiz 0,25', a?.psicologoCentavos === 876 && a?.taxaAdmCentavos === 25, JSON.stringify(a))
  const b = splitSobreLiquido(30000, 29205)
  ok('3× R$ 100 → psicólogo 284,55 / raiz 7,50', b?.psicologoCentavos === 28455 && b?.taxaAdmCentavos === 750, JSON.stringify(b))
  ok('valor baixo (líquido ≤ taxa) → sem split', splitSobreLiquido(100, 1) === null)
  ok('soma psicólogo + taxa = líquido', a!.psicologoCentavos + a!.taxaAdmCentavos === 901)
  ok('paraCentavos sem erro de float', paraCentavos(8.76) === 876 && paraCentavos(0.1 + 0.2) === 30 && paraCentavos('19.01') === 1901)
  ok('paraReais', paraReais(876) === 8.76)

  console.log('── situação cadastral ──')
  ok('PF recém-criada → pendente', situacaoDeStatus({ commercialInfo: 'APPROVED', bankAccountInfo: 'PENDING', documentation: 'PENDING', general: 'PENDING' }) === 'pendente')
  ok('PJ recém-criada → em_analise', situacaoDeStatus({ commercialInfo: 'AWAITING_APPROVAL', bankAccountInfo: 'PENDING', documentation: 'PENDING', general: 'PENDING' }) === 'em_analise')
  ok('tudo aprovado → aprovado', situacaoDeStatus({ commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED', general: 'APPROVED' }) === 'aprovado')
  ok('qualquer REJECTED → recusado (mesmo com general aprovado)', situacaoDeStatus({ commercialInfo: 'APPROVED', bankAccountInfo: 'REJECTED', documentation: 'APPROVED', general: 'APPROVED' }) === 'recusado')
  ok('sem dado → pendente', situacaoDeStatus(null) === 'pendente')

  console.log('── webhook: normalização ──')
  const pay = (ev: string, extra: Record<string, unknown> = {}) => ({
    id: `evt_d26e303b238e509335ac9ba210e51b0f&2428${Math.floor(Math.random() * 1e4)}`, event: ev, dateCreated: '2026-11-04 15:04:29',
    account: { id: 'c6554001-9d44-4e42-bc00-0a2ba049bc3f', ownerId: null },
    payment: { object: 'payment', id: 'pay_nsrefzy1j3s5td12', value: 10, netValue: 9.01, billingType: 'PIX', status: 'RECEIVED',
      externalReference: refSessao('0c554fe4-7d9b-4c44-a21f-c9a32114af56'), installment: null, subscription: null, ...extra },
  })
  const pago = normalizarEventoAsaas(pay('PAYMENT_RECEIVED'))
  ok('PIX RECEIVED → cobranca.paga com líquido', pago.tipo === 'cobranca.paga' && (pago as any).liquidoCentavos === 901 && (pago as any).valorCentavos === 1000, JSON.stringify(pago))
  ok('externalReference sessao:<id> → referencia', (pago as any).referencia === '0c554fe4-7d9b-4c44-a21f-c9a32114af56')
  ok('eventoId = string inteira (com &)', pago.eventoId.includes('&'))
  ok('cartão CONFIRMED → cobranca.paga', normalizarEventoAsaas(pay('PAYMENT_CONFIRMED', { billingType: 'CREDIT_CARD' })).tipo === 'cobranca.paga')
  const parc = normalizarEventoAsaas(pay('PAYMENT_CONFIRMED', { installment: '8986fe8d-b08c-46bf-9f3d-668dfa211082' }))
  ok('parcela → leva parcelamentoId', (parc as any).parcelamentoId === '8986fe8d-b08c-46bf-9f3d-668dfa211082')
  const casos: [string, string][] = [
    ['PAYMENT_OVERDUE', 'cobranca.vencida'], ['PAYMENT_DELETED', 'cobranca.cancelada'],
    ['PAYMENT_REPROVED_BY_RISK_ANALYSIS', 'cobranca.falhou'], ['PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'cobranca.falhou'],
    ['PAYMENT_REFUNDED', 'cobranca.reembolsada'], ['PAYMENT_PARTIALLY_REFUNDED', 'cobranca.reembolsada'],
    ['PAYMENT_CHARGEBACK_REQUESTED', 'cobranca.contestada'], ['PAYMENT_CHARGEBACK_DISPUTE', 'cobranca.contestada'],
    ['PAYMENT_SPLIT_DIVERGENCE_BLOCK', 'cobranca.split_bloqueado'],
    ['PAYMENT_CREATED', 'ignorado'], ['PAYMENT_UPDATED', 'ignorado'],
  ]
  for (const [ev, esperado] of casos) ok(`${ev} → ${esperado}`, normalizarEventoAsaas(pay(ev)).tipo === esperado)
  ok('PARTIALLY_REFUNDED → parcial=true', (normalizarEventoAsaas(pay('PAYMENT_PARTIALLY_REFUNDED')) as any).parcial === true)
  ok('REFUNDED → parcial=false', (normalizarEventoAsaas(pay('PAYMENT_REFUNDED')) as any).parcial === false)

  // Assinatura: pagamento com `subscription` preenchido.
  const sub = (ev: string) => normalizarEventoAsaas(pay(ev, { subscription: 'sub_ry187h6b4ef1oe03', billingType: 'CREDIT_CARD' }))
  ok('assinatura CONFIRMED → assinatura.paga', sub('PAYMENT_CONFIRMED').tipo === 'assinatura.paga' && (sub('PAYMENT_CONFIRMED') as any).assinaturaId === 'sub_ry187h6b4ef1oe03')
  ok('assinatura RECEIVED → assinatura.paga', sub('PAYMENT_RECEIVED').tipo === 'assinatura.paga')
  ok('assinatura OVERDUE → assinatura.falhou', sub('PAYMENT_OVERDUE').tipo === 'assinatura.falhou')
  ok('assinatura CAPTURE_REFUSED → assinatura.falhou', sub('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED').tipo === 'assinatura.falhou')
  ok('assinatura CREATED → ignorado (não toca sessão)', sub('PAYMENT_CREATED').tipo === 'ignorado')
  ok('SUBSCRIPTION_DELETED → assinatura.cancelada', normalizarEventoAsaas({ id: 'evt_x&1', event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_1' } }).tipo === 'assinatura.cancelada')
  ok('SUBSCRIPTION_INACTIVATED → assinatura.cancelada', normalizarEventoAsaas({ id: 'evt_x&2', event: 'SUBSCRIPTION_INACTIVATED', subscription: { id: 'sub_1' } }).tipo === 'assinatura.cancelada')
  ok('SUBSCRIPTION_CREATED → ignorado', normalizarEventoAsaas({ id: 'evt_x&3', event: 'SUBSCRIPTION_CREATED', subscription: { id: 'sub_1' } }).tipo === 'ignorado')

  // ACCOUNT_STATUS: payload real (spike §2). O evento "AWAITING_APPROVAL" chega
  // DEPOIS das aprovações — o snapshot manda, não o nome.
  const conta = normalizarEventoAsaas({
    id: 'evt_47666c74c276474a2a62c32755b7778e&24285040', event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
    dateCreated: '2026-11-04 15:23:21',
    account: { id: 'e241fd10-ca62-4e16-a45b-3d1cadb8b7a5', ownerId: 'c6554001-9d44-4e42-bc00-0a2ba049bc3f' },
    accountStatus: { id: 'e241fd10-ca62-4e16-a45b-3d1cadb8b7a5', commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED', general: 'APPROVED' },
  })
  ok('ACCOUNT_STATUS fora de ordem → vale o snapshot (aprovado)', conta.tipo === 'recebedor.situacao' && (conta as any).situacao === 'aprovado', JSON.stringify(conta))
  ok('ACCOUNT_STATUS → recebedorId da subconta', (conta as any).recebedorId === 'e241fd10-ca62-4e16-a45b-3d1cadb8b7a5')
  ok('payload sem id → ignorado', normalizarEventoAsaas({ event: 'PAYMENT_RECEIVED' }).tipo === 'ignorado')
  ok('evento desconhecido → ignorado', normalizarEventoAsaas({ id: 'evt_1&1', event: 'TRANSFER_DONE' }).tipo === 'ignorado')

  console.log('── referências ──')
  ok('sessaoDeRef ida e volta', sessaoDeRef(refSessao('abc')) === 'abc')
  ok('sessaoDeRef ignora outro prefixo', sessaoDeRef('psicologo:abc') === null && sessaoDeRef(null) === null)

  console.log('── token do webhook ──')
  ok('token igual → ok', tokenConfere('a'.repeat(48), 'a'.repeat(48)) === 'ok')
  ok('token diferente → invalido', tokenConfere('a'.repeat(48), 'b'.repeat(48)) === 'invalido')
  ok('tamanho diferente → invalido (sem lançar)', tokenConfere('abc', 'a'.repeat(48)) === 'invalido')
  ok('sem header → invalido', tokenConfere(null, 'x'.repeat(40)) === 'invalido')
  ok('sem token configurado → sem_config', tokenConfere('qualquer', undefined) === 'sem_config')

  console.log('── taxas do gateway ──')
  ok('taxa real tem prioridade', taxaGatewayReais({ gateway: 'asaas', metodo: 'pix', valor: 10, taxaRealCentavos: 99 }) === 0.99)
  ok('Asaas PIX estimado = R$ 1,99 fixo', taxaGatewayReais({ gateway: 'asaas', metodo: 'pix', valor: 200 }) === 1.99)
  ok('Asaas crédito 1x = 2,99% + 0,49', taxaGatewayReais({ gateway: 'asaas', metodo: 'credito', parcelas: 1, valor: 100 }) === 3.48)
  ok('Pagar.me PIX = 0,99%', taxaGatewayReais({ gateway: 'pagarme', metodo: 'pix', valor: 200 }) === 1.98)
  ok('sem gateway (legado) = tabela Pagar.me', taxaGatewayReais({ gateway: null, metodo: 'credito', parcelas: 3, valor: 100 }) === 4.99)

  console.log(falhou ? '\n✗ FALHOU' : '\n✓ TUDO OK')
  process.exit(falhou ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
