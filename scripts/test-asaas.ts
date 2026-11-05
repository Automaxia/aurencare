/**
 * Integração do adaptador Asaas contra o SANDBOX (sdd §8).
 *
 *   npm run test:asaas
 *
 * Exercita o código de produção (`asaasGateway`), não chamadas soltas:
 * subconta PF (+ idempotência), aprovação, PIX com split exato, crédito 3x
 * com split por parcelamento, débito → crédito, cobrança sem split, estornos,
 * assinatura (criar/trocar/cancelar). Recusa rodar fora do sandbox.
 * Cria dados de teste no sandbox (compartilhado com o BolsoAI — não mexe em
 * webhooks). Nunca imprime chaves.
 */
import { randomUUID, randomBytes } from 'node:crypto'

let falhou = false
function ok(descricao: string, cond: boolean, detalhe = '') {
  console.log(`${cond ? '✓' : '✗'} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!cond) falhou = true
}
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

function dv(base: string, pesos: number[]) {
  const r = base.split('').reduce((a, d, i) => a + Number(d) * pesos[i], 0) % 11
  return r < 2 ? 0 : 11 - r
}
function gerarCpf() {
  let b = ''; for (let i = 0; i < 9; i++) b += Math.floor(Math.random() * 10)
  const d1 = dv(b, [10, 9, 8, 7, 6, 5, 4, 3, 2]); return b + d1 + dv(b + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
}
function cartaoTeste() {
  const d = [4, ...Array.from({ length: 14 }, () => Math.floor(Math.random() * 10))]
  let s = 0
  for (let i = 0; i < 15; i++) { let x = d[14 - i]; if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9 } s += x }
  return [...d, (10 - (s % 10)) % 10].join('')
}

async function main() {
  if (!(process.env.ASAAS_API_URL || '').includes('api-sandbox.asaas.com')) {
    console.error('Recusado: ASAAS_API_URL não é o sandbox.'); process.exit(1)
  }
  const { asaasGateway } = await import('@/server/lib/pagamentos/asaas')
  const { asaas } = await import('@/server/lib/pagamentos/asaas/cliente')
  const { lerSituacao } = await import('@/server/lib/pagamentos/asaas/recebedor')
  const { garantirCustomer } = await import('@/server/lib/pagamentos/asaas/cobranca')
  const g = asaasGateway
  ok('adaptador configurado (chave do sandbox presente)', g.configurado() && g.ambiente() === 'sandbox')

  const saldo = async (chave?: string) => Number((await asaas('GET', '/finance/balance', undefined, { chave })).balance)
  const t = randomBytes(3).toString('hex')

  console.log('\n── subconta PF ──')
  const cpfPsi = gerarCpf()
  const rec = await g.criarRecebedor({
    tipoPessoa: 'PF', documento: cpfPsi, razaoSocial: `Psicóloga Teste ${t}`,
    email: `spike.asaas+teste-${t}@audere.ia.br`, telefone: '11987654321',
    dataNascimento: '1990-05-10', rendaCentavos: 800000,
    endereco: { cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', complemento: 'Sala 1', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
  })
  ok('criarRecebedor → id + walletId + apiKey', !!rec.id && !!rec.walletId && !!rec.apiKey && rec.gateway === 'asaas', `id=${rec.id} situacao=${rec.situacao}`)
  const de_novo = await g.criarRecebedor({
    tipoPessoa: 'PF', documento: cpfPsi, razaoSocial: `Psicóloga Teste ${t}`, email: `spike.asaas+teste2-${t}@audere.ia.br`,
    telefone: '11987654321', dataNascimento: '1990-05-10', rendaCentavos: 800000,
    endereco: { cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
  })
  ok('mesmo CPF de novo → reaproveita (não duplica)', de_novo.reaproveitado === true && de_novo.id === rec.id && de_novo.walletId === rec.walletId)
  // Refazer o cadastro (ex.: PF → PJ) com o MESMO e-mail: o Asaas recusa e-mail
  // repetido → a 2ª subconta sai com o alias +audere2.
  const emailRepetido = `spike.asaas+teste-${t}@audere.ia.br`
  const outra = await g.criarRecebedor({
    tipoPessoa: 'PF', documento: gerarCpf(), razaoSocial: `Psicóloga Teste B ${t}`, email: emailRepetido,
    telefone: '11987654321', dataNascimento: '1990-05-10', rendaCentavos: 800000,
    endereco: { cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
  })
  ok('e-mail já usado → 2ª subconta com alias +audere2', outra.id !== rec.id && !!outra.walletId
    && outra.emailUsado === `spike.asaas+teste-${t}+audere2@audere.ia.br`, `id=${outra.id} email=${outra.emailUsado}`)

  // Aprovação no sandbox (retenta: logo após criar pode dar 500 — spike §2)
  for (let i = 0; i < 5; i++) {
    try { await asaas('POST', '/sandbox/myAccount/approve', {}, { chave: rec.apiKey! }); break }
    catch { await esperar(10_000) }
  }
  await esperar(3000)
  const sit = await lerSituacao(rec.apiKey!)
  ok('lerSituacao (apiKey da subconta) → aprovado', sit.situacao === 'aprovado', JSON.stringify(sit.detalhe))

  const recebedor = { gateway: 'asaas' as const, id: rec.id, walletId: rec.walletId }
  const paciente = { id: randomUUID(), nome: `Paciente Teste ${t}`, telefone: '5511987654321', cpf: gerarCpf(), email: null }

  console.log('\n── PIX com split (D-01) ──')
  const s1 = randomUUID()
  const pix = await g.criarCobrancaSessao({ sessaoId: s1, valorCentavos: 1000, metodo: 'pix', paciente, recebedor, dataSessao: new Date(Date.now() + 86400_000).toISOString() })
  ok('cobrança PIX criada com copia e cola + fatura', !!pix.qrCode && !!pix.url && pix.cobrancaId.startsWith('pay_'), pix.cobrancaId)
  ok('taxaAdm = R$ 0,25', pix.taxaAdmCentavos === 25)
  const p1 = await asaas('GET', `/payments/${pix.cobrancaId}`)
  ok('split gravado = líquido − 0,25', p1.split?.[0]?.fixedValue === Math.round((p1.netValue - 0.25) * 100) / 100 && p1.split?.[0]?.walletId === rec.walletId, `net=${p1.netValue} split=${p1.split?.[0]?.fixedValue}`)
  ok('externalReference = sessao:<id>', p1.externalReference === `sessao:${s1}`)
  const c2 = await garantirCustomer({ ref: `paciente:${paciente.id}`, nome: paciente.nome, cpfCnpj: paciente.cpf })
  ok('customer do paciente reaproveitado pelo externalReference', c2 === p1.customer)
  const cust = await asaas('GET', `/customers/${p1.customer}`)
  ok('customer com notificationDisabled=true', cust.notificationDisabled === true)
  const raiz0 = await saldo(); const psi0 = await saldo(rec.apiKey!)
  await asaas('POST', `/sandbox/payment/${pix.cobrancaId}/confirm`, {})
  await esperar(4000)
  const dRaiz = Math.round(((await saldo()) - raiz0) * 100) / 100
  const dPsi = Math.round(((await saldo(rec.apiKey!)) - psi0) * 100) / 100
  ok('pago: raiz +0,25 e psicólogo +líquido−0,25', dRaiz === 0.25 && dPsi === p1.split?.[0]?.fixedValue, `raiz Δ${dRaiz} · psicólogo Δ${dPsi}`)

  console.log('\n── crédito 3x com split por parcelamento ──')
  const s2 = randomUUID()
  const cc = await g.criarCobrancaSessao({ sessaoId: s2, valorCentavos: 30000, metodo: 'credito', parcelas: 3, paciente, recebedor })
  ok('parcelado: parcelamentoId + 3 parcelas + fatura', !!cc.parcelamentoId && cc.parcelas === 3 && !!cc.url, `installment=${cc.parcelamentoId}`)
  ok('taxaAdm = R$ 7,50 (2,5% de 300)', cc.taxaAdmCentavos === 750)
  await asaas('POST', `/payments/${cc.cobrancaId}/payWithCreditCard`, {
    creditCard: { holderName: 'PACIENTE TESTE', number: cartaoTeste(), expiryMonth: '12', expiryYear: String(new Date().getFullYear() + 3), ccv: '123' },
    creditCardHolderInfo: { name: paciente.nome, email: `spike.asaas+cc-${t}@audere.ia.br`, cpfCnpj: paciente.cpf, postalCode: '01310100', addressNumber: '1000', phone: '11987654321' },
  })
  await esperar(4000)
  const parcelas = (await asaas('GET', `/payments?installment=${cc.parcelamentoId}&limit=10`)).data
  const liq = Math.round(parcelas.reduce((a: number, x: any) => a + x.netValue, 0) * 100)
  const spl = Math.round(parcelas.reduce((a: number, x: any) => a + (x.split?.[0]?.totalValue ?? x.split?.[0]?.fixedValue ?? 0), 0) * 100)
  ok('3 parcelas confirmadas, sobra da raiz = 7,50', parcelas.length === 3 && parcelas.every((x: any) => x.status === 'CONFIRMED') && liq - spl === 750, `Σlíquido=${liq / 100} Σsplit=${spl / 100}`)

  console.log('\n── débito e sem recebedor ──')
  const db1 = await g.criarCobrancaSessao({ sessaoId: randomUUID(), valorCentavos: 5000, metodo: 'debito', paciente, recebedor })
  ok('débito → cobrado como crédito à vista (Asaas não tem débito)', db1.metodo === 'credito' && db1.parcelas === 1)
  const semSplit = await g.criarCobrancaSessao({ sessaoId: randomUUID(), valorCentavos: 5000, metodo: 'pix', paciente, recebedor: null })
  const ps = await asaas('GET', `/payments/${semSplit.cobrancaId}`)
  ok('sem recebedor → cobrança sem split, taxaAdm 0 (RF-PG-24)', semSplit.taxaAdmCentavos === 0 && !(ps.split?.length))
  await asaas('DELETE', `/payments/${db1.cobrancaId}`).catch(() => {})
  await asaas('DELETE', `/payments/${semSplit.cobrancaId}`).catch(() => {})

  console.log('\n── estornos ──')
  const e1 = await g.reembolsar({ cobrancaId: cc.cobrancaId, parcelamentoId: cc.parcelamentoId })
  ok('estorno do parcelamento (cartão) → estornado', e1.status === 'estornado', JSON.stringify(e1))
  const e2 = await g.reembolsar({ cobrancaId: pix.cobrancaId })
  ok('estorno PIX → solicitado (evento crítico) ou pendente (saldo/tempo)', e2.status === 'solicitado' || e2.status === 'pendente', JSON.stringify(e2))
  const mock = await g.reembolsar({ cobrancaId: 'mock_asaas_pix_x' })
  ok('estorno de cobrança mock → estornado sem rede', mock.status === 'estornado')

  console.log('\n── assinatura (D-04) ──')
  const psi = { id: randomUUID(), nome: `Psicóloga Assinante ${t}`, email: `spike.asaas+sub-${t}@audere.ia.br`, documento: gerarCpf(), telefone: '11987654321' }
  const as1 = await g.criarAssinatura({ plano: 'essencial', ciclo: 'mensal', psicologo: psi })
  ok('assinatura sem cartão → aguardando_pagamento + fatura', as1.status === 'aguardando_pagamento' && !!as1.urlPagamento && as1.assinaturaId.startsWith('sub_'), as1.urlPagamento ?? '')
  const up = await g.atualizarAssinatura!(as1.assinaturaId, { plano: 'pro', ciclo: 'mensal', psicologo: psi })
  const subDepois = await asaas('GET', `/subscriptions/${as1.assinaturaId}`)
  ok('trocar de plano por PUT (valor do Pro)', up.ok && subDepois.value === 159.9, `value=${subDepois.value}`)
  let semDoc = ''
  try { await g.criarAssinatura({ plano: 'essencial', ciclo: 'mensal', psicologo: { ...psi, id: randomUUID(), documento: null } }) }
  catch (err) { semDoc = (err as Error).message }
  ok('assinante sem documento → erro nomeado', semDoc === 'documento_assinante_ausente', semDoc)
  ok('cancelar assinatura', await g.cancelarAssinatura(as1.assinaturaId))
  ok('cancelar de novo (já removida) → true', await g.cancelarAssinatura(as1.assinaturaId))

  console.log(falhou ? '\n✗ FALHOU' : '\n✓ TUDO OK')
  process.exit(falhou ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
