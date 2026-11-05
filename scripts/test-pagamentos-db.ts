/**
 * Teste de integração da camada de pagamentos com Postgres REAL (migration 053
 * + serviços). O que precisa ser provado é SQL: backfill, lookup da cobrança
 * pelos dois gateways, confirmação idempotente, "não sobrescrever pago",
 * deduplicação de webhook e o fallback para as colunas `pagarme_*`.
 *
 * Uso (container efêmero, mesmo padrão do test:excluir):
 *
 *   docker run -d --rm --name audere-test-pg \
 *     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=audere_test \
 *     -p 55433:5432 postgres:16-alpine
 *
 *   export DATABASE_URL="postgresql://postgres:test@localhost:55433/audere_test"
 *   npx tsx src/server/db/migrate.ts
 *   npm run test:pagamentos-db
 *
 *   docker stop audere-test-pg
 *
 * NÃO carrega .env.local (aponta pro banco real) e recusa qualquer banco que
 * não seja local com "test" no nome. Sem chaves de gateway: tudo em modo mock.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('✗ DATABASE_URL ausente — veja o cabeçalho deste arquivo.'); process.exit(1) }
  const u = new URL(url)
  if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname) || !/test/i.test(u.pathname)) {
    console.error(`✗ recusando rodar: só banco de teste local (host=${u.hostname} banco=${u.pathname.slice(1)}).`)
    process.exit(1)
  }
  for (const k of ['PAGARME_API_KEY', 'ASAAS_API_KEY', 'META_WA_TOKEN', 'EVOLUTION_API_KEY', 'RESEND_API_KEY']) delete process.env[k]
}
exigirBancoDeTeste()
process.env.ENCRYPTION_KEY ||= 'chave-de-teste-pagamentos'

let falhas = 0
function ok(nome: string, cond: boolean, detalhe = '') {
  console.log(`${cond ? '✓' : '✗'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!cond) falhas++
}

async function main() {
  const { db } = await import('@/server/db/pool')
  const { env } = await import('@/server/lib/env')
  const sessoes = await import('@/server/services/sessoes')
  const { lerStatusOnboarding, atualizarSituacaoRecebedor } = await import('@/server/services/onboardingPagamento')
  const { aplicarEventoAssinatura, obterAssinatura } = await import('@/server/services/assinatura')
  const { registrarEvento, concluirEvento, aplicarEventoPagamento } = await import('@/server/services/eventosPagamento')
  const { normalizarEventoAsaas } = await import('@/server/lib/pagamentos/asaas/webhook')

  const t = randomUUID().slice(0, 8)
  const { rows: [psi] } = await db.query(
    `INSERT INTO psicologos (nome, crp, email, senha_hash, telefone) VALUES ($1, $2, $3, 'x', '11987654321') RETURNING id`,
    [`Psi ${t}`, `CRP-${t}`, `psi-${t}@teste.local`])
  const { rows: [pac] } = await db.query(
    `INSERT INTO pacientes (psicologo_id, nome, telefone) VALUES ($1, $2, '5511987654321') RETURNING id`,
    [psi.id, `Pac ${t}`])
  let n = 0
  const novaSessao = async (extra: Record<string, unknown> = {}) => {
    const linha: Record<string, unknown> = {
      psicologo_id: psi.id, paciente_id: pac.id, numero: ++n, data_hora: new Date(Date.now() + 3 * 86400_000).toISOString(),
      valor: 100, pagamento_status: 'pendente', status: 'aguardando_pagamento', ...extra,
    }
    const cols = Object.keys(linha)
    const vals = Object.values(linha)
    const { rows } = await db.query(
      `INSERT INTO sessoes (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, vals)
    return rows[0].id as string
  }
  const ler = async (id: string) => (await db.query(`SELECT * FROM sessoes WHERE id = $1`, [id])).rows[0]

  try {
    console.log('── migration 053: backfill e idempotência ──')
    const legado = await novaSessao({ pagarme_order_id: `or_${t}`, pagarme_checkout_url: 'https://x/checkout' })
    await db.query(`UPDATE psicologos SET pagarme_recipient_id = $2, pgm_ambiente = 'sandbox', pgm_onboarding_em = NOW() WHERE id = $1`, [psi.id, `re_${t}`])
    const sql = readFileSync(join(process.cwd(), 'src/server/db/migrations/053_gateway_neutro.sql'), 'utf8')
    await db.query(sql)
    await db.query(sql) // 2ª vez: não pode falhar nem duplicar
    const l = await ler(legado)
    ok('sessão legada recebe gateway/cobranca_id/cobranca_url', l.gateway === 'pagarme' && l.cobranca_id === `or_${t}` && l.cobranca_url === 'https://x/checkout')
    const { rows: [p0] } = await db.query(`SELECT recebedor_gateway, recebedor_id, recebedor_ambiente FROM psicologos WHERE id = $1`, [psi.id])
    ok('recebedor legado → colunas neutras', p0.recebedor_gateway === 'pagarme' && p0.recebedor_id === `re_${t}` && p0.recebedor_ambiente === 'sandbox')

    console.log('── onboarding: recebedor vale só no gateway padrão ──')
    env.paymentGateway = 'pagarme'
    let st = await lerStatusOnboarding(psi.id)
    ok('Pagar.me padrão + recebedor Pagar.me sandbox → completo', st.completo && st.recebedor?.walletId === `re_${t}`, JSON.stringify(st.recebedor))
    env.paymentGateway = 'asaas'
    st = await lerStatusOnboarding(psi.id)
    ok('Asaas padrão + só recebedor Pagar.me → incompleto (vai recriar)', !st.completo && st.recipientInvalido && st.recebedor === null)
    await db.query(`UPDATE psicologos SET recebedor_gateway='asaas', recebedor_id=$2, recebedor_wallet_id=$3, recebedor_ambiente='sandbox', recebedor_situacao='pendente' WHERE id=$1`,
      [psi.id, `acc_${t}`, `wal_${t}`])
    st = await lerStatusOnboarding(psi.id)
    ok('Asaas padrão + subconta Asaas pendente → completo (RN-06: split com walletId)', st.completo && st.recebedor?.walletId === `wal_${t}` && st.situacao === 'pendente')
    await atualizarSituacaoRecebedor('asaas', `acc_${t}`, 'recusado', { general: 'REJECTED' })
    st = await lerStatusOnboarding(psi.id)
    ok('subconta recusada (webhook) → incompleto', !st.completo && st.situacao === 'recusado')
    await atualizarSituacaoRecebedor('asaas', `acc_${t}`, 'aprovado', { general: 'APPROVED' })
    ok('subconta aprovada de novo → completo', (await lerStatusOnboarding(psi.id)).completo)

    // O wizard de verdade (gravarRecebedor): o E2E de 04/11 pegou "inconsistent
    // types deduced for parameter $2" — o SQL precisa rodar nos dois gateways.
    const { salvarOnboarding } = await import('@/server/services/onboardingPagamento')
    const wizard = {
      tipoPessoa: 'PF' as const, documento: '52998224725', razaoSocial: `Psi ${t}`, dataNascimento: '1990-05-10', rendaCentavos: 800000,
      endereco: { cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', complemento: null, bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
      socio: null,
      banco: { codigo: '341', agencia: '0001', agenciaDv: null, conta: '12345', contaDv: '6', tipo: 'corrente' as const, titularNome: `Psi ${t}`, titularDocumento: '52998224725' },
      chavePix: null,
    }
    for (const gw of ['asaas', 'pagarme'] as const) {
      env.paymentGateway = gw
      const sv = await salvarOnboarding(psi.id, wizard)
      const { rows: [pw] } = await db.query(`SELECT recebedor_gateway, recebedor_id, pagarme_recipient_id, pgm_onboarding_em FROM psicologos WHERE id = $1`, [psi.id])
      ok(`wizard no ${gw} (mock) grava o recebedor`, sv.ok && pw.recebedor_gateway === gw && !!pw.recebedor_id && !!pw.pgm_onboarding_em
        && (gw === 'pagarme' ? pw.pagarme_recipient_id === pw.recebedor_id : true), JSON.stringify(sv))
    }
    env.paymentGateway = 'asaas'
    await db.query(`UPDATE psicologos SET recebedor_gateway='asaas', recebedor_id=$2, recebedor_wallet_id=$3, recebedor_ambiente='sandbox', recebedor_situacao='aprovado' WHERE id=$1`,
      [psi.id, `acc_${t}`, `wal_${t}`])

    console.log('── cobrança: gerar no gateway padrão (mock) ──')
    await db.query(`UPDATE pacientes SET dados_cadastro = jsonb_build_object('cpf', '52998224725') WHERE id = $1`, [pac.id])
    const sAsaas = await novaSessao()
    const g1 = await sessoes.gerarCobrancaPix(sAsaas)
    ok('PIX no Asaas (mock): gateway/cobranca gravados, sem colunas pagarme_*', g1.gateway === 'asaas' && !!g1.cobrancaId?.startsWith('mock_asaas_pix') && !(await ler(sAsaas)).pagarme_order_id)
    env.paymentGateway = 'pagarme'
    await db.query(`UPDATE psicologos SET recebedor_gateway='pagarme', recebedor_id=$2, recebedor_wallet_id=$2 WHERE id=$1`, [psi.id, `re_${t}`])
    const sPgm = await novaSessao()
    const g2 = await sessoes.gerarCobrancaCartao(sPgm, 'credito')
    const r2 = await ler(sPgm)
    ok('cartão na Pagar.me (mock): dual-write nas colunas pagarme_*', g2.gateway === 'pagarme' && r2.pagarme_order_id === r2.cobranca_id && r2.pagarme_checkout_url === r2.cobranca_url)

    console.log('── webhook: confirmação idempotente e guardas ──')
    await sessoes.marcarPagamentoConfirmado({ gateway: 'asaas', cobrancaId: g1.cobrancaId! }, { valorCentavos: 10000, liquidoCentavos: 9801 })
    let r = await ler(sAsaas)
    ok('Asaas pago → confirmada + taxa real 1,99', r.pagamento_status === 'pago' && r.status === 'confirmada' && r.taxa_gateway_centavos === 199)
    const pagoEm = r.pago_em
    await sessoes.marcarPagamentoConfirmado({ gateway: 'asaas', cobrancaId: g1.cobrancaId! })
    ok('2ª confirmação não reescreve pago_em', +(await ler(sAsaas)).pago_em === +pagoEm)
    await sessoes.marcarPagamentoCancelado({ gateway: 'asaas', cobrancaId: g1.cobrancaId! })
    ok('cancelamento DEPOIS do pago não sobrescreve (RF-PG-32)', (await ler(sAsaas)).pagamento_status === 'pago')
    const sOutro = await novaSessao({ gateway: 'asaas', cobranca_id: `pay_outro_${t}` })
    await sessoes.marcarPagamentoConfirmado({ gateway: 'pagarme', cobrancaId: `pay_outro_${t}` })
    ok('mesmo id vindo de OUTRO gateway não confirma', (await ler(sOutro)).pagamento_status === 'pendente')

    await sessoes.marcarPagamentoConfirmado(`or_${t}`)
    ok('Pagar.me legado (só pagarme_order_id, assinatura antiga string) → pago', (await ler(legado)).pagamento_status === 'pago')

    const sParc = await novaSessao({ gateway: 'asaas', cobranca_id: `pay_1_${t}`, cobranca_parcelamento_id: `inst_${t}` })
    await sessoes.marcarPagamentoConfirmado({ gateway: 'asaas', cobrancaId: `pay_3_${t}`, parcelamentoId: `inst_${t}` })
    ok('evento de OUTRA parcela acha a sessão pelo installment', (await ler(sParc)).pagamento_status === 'pago')
    const sRef = await novaSessao({ gateway: 'asaas', cobranca_id: `pay_x_${t}` })
    await sessoes.marcarPagamentoConfirmado({ gateway: 'asaas', cobrancaId: `pay_desconhecido_${t}`, sessaoId: sRef })
    ok('externalReference sessao:<id> como último recurso', (await ler(sRef)).pagamento_status === 'pago')
    await sessoes.marcarPagamentoConfirmado({ gateway: 'asaas', cobrancaId: 'x', sessaoId: 'nao-e-uuid' })
    ok('referência inválida não quebra a query', true)

    const sFalha = await novaSessao({ gateway: 'asaas', cobranca_id: `pay_f_${t}` })
    await sessoes.marcarPagamentoCancelado({ gateway: 'asaas', cobrancaId: `pay_f_${t}` })
    ok('pendente + cancelamento → falhou', (await ler(sFalha)).pagamento_status === 'falhou')

    console.log('── estorno no gateway de ORIGEM ──')
    // Padrão agora é Pagar.me, mas a sessão nasceu no Asaas: estorna no Asaas (mock).
    const c1 = await sessoes.cancelarSessao(sAsaas)
    r = await ler(sAsaas)
    ok('cancelar >24h sessão Asaas paga → reembolsado (gateway de origem)', c1.reembolsada && r.pagamento_status === 'reembolsado' && r.status === 'cancelada')
    await sessoes.marcarReembolsado({ gateway: 'asaas', cobrancaId: g1.cobrancaId! }, false)
    ok('webhook REFUNDED depois → continua reembolsado', (await ler(sAsaas)).pagamento_status === 'reembolsado')

    console.log('── webhook_eventos ──')
    const evId = `evt_05b708f961d739ea7eba7e4db318f621&${Date.now()}`
    ok('1ª entrega → novo', (await registrarEvento('asaas', evId, 'PAYMENT_RECEIVED', { id: evId })) === 'novo')
    await concluirEvento('asaas', evId, new Error('falhou de propósito'))
    ok('falhou antes → reprocessa (novo)', (await registrarEvento('asaas', evId, 'PAYMENT_RECEIVED', { id: evId })) === 'novo')
    await concluirEvento('asaas', evId)
    ok('processado → duplicado', (await registrarEvento('asaas', evId, 'PAYMENT_RECEIVED', { id: evId })) === 'duplicado')
    ok('mesmo id em outro gateway é outro evento', (await registrarEvento('pagarme', evId, 'order.paid', {})) === 'novo')
    const outro = evId.replace(/&\d+$/, '&1')
    ok('mesmo hex, número diferente → evento diferente', (await registrarEvento('asaas', outro, 'PAYMENT_RECEIVED', {})) === 'novo')
    await registrarEvento('asaas', `evt_cpf&${t}`, 'X', { payment: { creditCard: { creditCardNumber: '1111', creditCardToken: 'tok' }, customer: { cpfCnpj: '52998224725' } } })
    const { rows: [pl] } = await db.query(`SELECT payload FROM webhook_eventos WHERE evento_id = $1`, [`evt_cpf&${t}`])
    ok('payload guardado sem cartão e com CPF mascarado', !JSON.stringify(pl.payload).includes('tok') && !JSON.stringify(pl.payload).includes('52998224725'), JSON.stringify(pl.payload))

    console.log('── assinar (SQL do UPDATE nos dois gateways, mock) ──')
    const { assinar } = await import('@/server/services/assinatura')
    for (const gw of ['asaas', 'pagarme'] as const) {
      env.paymentGateway = gw
      await db.query(`UPDATE psicologos SET plano='free', plano_status='ativo', assinatura_gateway=NULL, assinatura_id=NULL, pagarme_subscription_id=NULL WHERE id=$1`, [psi.id])
      const as = await assinar(psi.id, 'essencial', 'mensal', gw === 'pagarme' ? 'card_mock' : undefined)
      const { rows: [pa] } = await db.query(`SELECT assinatura_gateway, assinatura_id, pagarme_subscription_id FROM psicologos WHERE id = $1`, [psi.id])
      ok(`assinar no ${gw} (mock) grava a assinatura`, as.ok && pa.assinatura_gateway === gw && !!pa.assinatura_id
        && (gw === 'pagarme' ? pa.pagarme_subscription_id === pa.assinatura_id : pa.pagarme_subscription_id === null), JSON.stringify(as))
    }
    env.paymentGateway = 'asaas'

    console.log('── manutenção (cron) ──')
    const man = await import('@/server/services/manutencaoPagamentos')
    const sEst = await novaSessao({ gateway: 'asaas', cobranca_id: `mock_asaas_pix_e_${t}`, pagamento_status: 'pago', status: 'cancelada',
      reembolso_pendente_em: new Date(Date.now() - 2 * 3600_000).toISOString(), reembolso_motivo: 'sem saldo' })
    const e1 = await man.repetirEstornosPendentes()
    const rEst = await ler(sEst)
    ok('estorno pendente repetido → reembolsado e fila limpa', e1.estornados >= 1 && rEst.pagamento_status === 'reembolsado' && rEst.reembolso_pendente_em === null)
    const sVenc = await novaSessao({ gateway: 'asaas', pagamento_metodo: 'pix', cobranca_id: `mock_asaas_pix_v_${t}`, cobranca_vence_em: new Date(Date.now() - 3600_000).toISOString() })
    const sNoPrazo = await novaSessao({ gateway: 'asaas', pagamento_metodo: 'pix', cobranca_id: `mock_asaas_pix_p_${t}`, cobranca_vence_em: new Date(Date.now() + 600_000).toISOString() })
    const sVencPago = await novaSessao({ gateway: 'asaas', pagamento_metodo: 'pix', pagamento_status: 'pago', cobranca_id: `mock_asaas_pix_g_${t}`, cobranca_vence_em: new Date(Date.now() - 3600_000).toISOString() })
    await man.cancelarPixVencidos()
    ok('PIX vencido (D-05) → falhou', (await ler(sVenc)).pagamento_status === 'falhou')
    ok('PIX ainda no prazo → intacto', (await ler(sNoPrazo)).pagamento_status === 'pendente')
    ok('PIX vencido mas pago → intacto', (await ler(sVencPago)).pagamento_status === 'pago')
    const sWh = await novaSessao({ gateway: 'asaas', cobranca_id: `pay_wh_${t}` })
    const evWh = `evt_wh&${t}`
    await registrarEvento('asaas', evWh, 'PAYMENT_RECEIVED', { id: evWh, event: 'PAYMENT_RECEIVED', payment: { id: `pay_wh_${t}`, value: 100, netValue: 99.01, billingType: 'PIX' } })
    await concluirEvento('asaas', evWh, new Error('banco fora do ar'))
    const w1 = await man.reprocessarWebhooks()
    const { rows: [wr] } = await db.query(`SELECT processado_em, erro FROM webhook_eventos WHERE evento_id = $1`, [evWh])
    ok('webhook com erro reprocessado → sessão paga e evento concluído', w1.reprocessados >= 1 && (await ler(sWh)).pagamento_status === 'pago' && !!wr.processado_em && wr.erro === null)

    console.log('── assinatura Asaas por webhook ──')
    await db.query(`UPDATE psicologos SET plano='essencial', plano_status='inadimplente', plano_ciclo='mensal', plano_expira_em=NOW(),
                      assinatura_gateway='asaas', assinatura_id=$2 WHERE id=$1`, [psi.id, `sub_${t}`])
    ok('aguardando 1º pagamento → efetivo free', (await obterAssinatura(psi.id)).plano === 'free')
    await aplicarEventoPagamento('asaas', normalizarEventoAsaas({ id: `evt_s&${t}`, event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_s', subscription: `sub_${t}`, value: 69.9 } }))
    const a1 = await obterAssinatura(psi.id)
    ok('1ª cobrança paga → ativo, essencial, expira no futuro', a1.plano === 'essencial' && a1.status === 'ativo' && Date.parse(a1.expiraEm!) > Date.now())
    await aplicarEventoAssinatura(`sub_${t}`, 'cancelado', null, 'pagarme')
    ok('evento de OUTRO gateway com o mesmo id não mexe', (await obterAssinatura(psi.id)).status === 'ativo')
    await aplicarEventoPagamento('asaas', normalizarEventoAsaas({ id: `evt_d&${t}`, event: 'SUBSCRIPTION_DELETED', subscription: { id: `sub_${t}` } }))
    ok('SUBSCRIPTION_DELETED → cancelado (acesso até expirar)', (await obterAssinatura(psi.id)).status === 'cancelado')

    console.log('── troca de plano (regra pura) ──')
    const { calcularTroca } = await import('@/server/lib/trocaPlano')
    const base = { cicloAtual: 'mensal' as const, cicloNovo: 'mensal' as const, expiraEm: '2026-12-04T15:00:00Z', agora: new Date('2026-11-14T15:00:00Z') }
    const up = calcularTroca({ ...base, planoAtual: 'essencial', planoNovo: 'pro' })
    ok('subir faltando 20 de 30 dias → R$ 60,00 na fatura, Pro na hora', up.tipo === 'upgrade' && up.planoAgora === 'pro' && up.acrescimoCentavos === 6000 && !up.agendado, JSON.stringify(up))
    const down = calcularTroca({ ...base, planoAtual: 'pro', planoNovo: 'essencial' })
    ok('descer → agendado, segue Pro, sem acréscimo', down.tipo === 'agendada' && down.planoAgora === 'pro' && down.agendado?.plano === 'essencial' && down.acrescimoCentavos === 0)
    const upAnual = calcularTroca({ ...base, planoAtual: 'essencial', planoNovo: 'pro', cicloNovo: 'anual' })
    ok('subir + anual → Pro agora (diferença no mensal), anual agendado', upAnual.planoAgora === 'pro' && upAnual.cicloAgora === 'mensal' && upAnual.acrescimoCentavos === 6000 && upAnual.agendado?.ciclo === 'anual')
    ok('ciclo vencido → sem acréscimo', calcularTroca({ ...base, planoAtual: 'essencial', planoNovo: 'pro', agora: new Date('2026-12-10T00:00:00Z') }).acrescimoCentavos === 0)
    ok('mesmo plano/ciclo → sem mudança', calcularTroca({ ...base, planoAtual: 'pro', planoNovo: 'pro' }).tipo === 'sem_mudanca')

    console.log('── troca de plano (assinar + webhook, Asaas mock) ──')
    const subT = `mock_asaas_sub_troca_${t}`
    await db.query(`UPDATE psicologos SET plano='essencial', plano_status='ativo', plano_ciclo='mensal',
                      plano_expira_em = NOW() + interval '20 days', assinatura_gateway='asaas', assinatura_id=$2,
                      plano_agendado=NULL, plano_ciclo_agendado=NULL, plano_agendado_vigencia=NULL WHERE id=$1`, [psi.id, subT])
    const t1 = await assinar(psi.id, 'pro', 'mensal')
    const a2 = await obterAssinatura(psi.id)
    ok('upgrade → Pro na hora, com acréscimo, sem agendamento', t1.ok && t1.troca?.tipo === 'upgrade' && (t1.troca?.acrescimoCentavos ?? 0) > 0
      && a2.plano === 'pro' && a2.agendado === null, JSON.stringify(t1))
    const t2 = await assinar(psi.id, 'essencial', 'mensal')
    const a3 = await obterAssinatura(psi.id)
    ok('downgrade → continua Pro, Essencial agendado', t2.ok && a3.plano === 'pro' && a3.agendado?.plano === 'essencial', JSON.stringify(a3.agendado))
    await assinar(psi.id, 'pro', 'mensal')
    ok('escolher o plano atual → desfaz o agendamento', (await obterAssinatura(psi.id)).agendado === null)
    await assinar(psi.id, 'essencial', 'mensal')
    await db.query(`UPDATE psicologos SET plano_agendado_vigencia = '2026-12-04' WHERE id = $1`, [psi.id])
    await aplicarEventoAssinatura(subT, 'renovado', null, 'asaas', '2026-11-04')
    ok('pagamento de ciclo ANTERIOR (RECEIVED atrasado) não antecipa a troca', (await obterAssinatura(psi.id)).plano === 'pro')
    await aplicarEventoAssinatura(subT, 'renovado', null, 'asaas', '2026-12-04')
    const a4 = await obterAssinatura(psi.id)
    ok('renovação no vencimento agendado → Essencial e agendamento limpo', a4.plano === 'essencial' && a4.agendado === null && a4.status === 'ativo', JSON.stringify(a4))
  } finally {
    await db.query(`DELETE FROM psicologos WHERE id = $1`, [psi.id]).catch(() => {})
    await db.query(`DELETE FROM webhook_eventos WHERE evento_id LIKE '%${t}%' OR recebido_em > NOW() - interval '10 minutes'`).catch(() => {})
    await db.end()
  }
  console.log(falhas ? `\n✗ ${falhas} FALHA(S)` : '\n✓ TUDO OK')
  process.exit(falhas ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
