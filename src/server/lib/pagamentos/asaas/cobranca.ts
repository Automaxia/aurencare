import 'server-only'
/**
 * Cobrança de sessão no Asaas. docs/asaas/sdd.md §4.2, §4.4; spike.md §4, §5, §7.
 *
 * Quem cria é a conta RAIZ (D-02), com split para a `walletId` do psicólogo.
 * O split vai DEPOIS da criação (D-01): o `netValue` já vem na resposta e o
 * psicólogo recebe `líquido − 2,5% do bruto` em valor fixo — a raiz fica com
 * exatamente a taxa administrativa.
 */
import { log } from '../../log'
import { asaas, AsaasErro } from './cliente'
import { refSessao } from './ref'
import { splitSobreLiquido, paraCentavos, paraReais } from '../split'
import type { CobrancaSessaoInput, CobrancaCriada, ReembolsoInput, ReembolsoResultado, MetodoSessao } from '../tipos'

const MIN_PIX = 30 * 60 * 1000
const MIN_CARTAO = 2 * 60 * 60 * 1000


/** Data de hoje em São Paulo (AAAA-MM-DD). */
function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function dataSP(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/**
 * Customer do pagador. Busca pelo `externalReference` (paciente:<id>) antes de
 * criar. `notificationDisabled=true`: quem avisa o paciente é o WhatsApp da
 * Audere, não e-mail/SMS do Asaas (spike §8 — confirmado no painel).
 */
export async function garantirCustomer(p: {
  ref: string; nome: string; cpfCnpj?: string | null; email?: string | null
  /** Assinante (psicólogo): manda o e-mail — é para onde vão os recibos da mensalidade. */
  comContato?: boolean
}): Promise<string> {
  const achado = await asaas('GET', `/customers?externalReference=${encodeURIComponent(p.ref)}&limit=1`)
  const c = achado?.data?.find((x: any) => !x.deleted)
  const doc = p.cpfCnpj?.replace(/\D/g, '') || undefined
  if (c) {
    // Cadastro antigo sem documento: completa (PIX e cartão exigem).
    if (doc && c.cpfCnpj !== doc) {
      await asaas('PUT', `/customers/${c.id}`, { cpfCnpj: doc }).catch(err =>
        log.warn('asaas.cobranca', `não atualizou documento do customer ${c.id}: ${(err as Error).message}`))
    }
    return c.id
  }
  if (!doc) throw new Error('cpf_paciente_ausente')
  // Sem e-mail/telefone de propósito: com as notificações desligadas eles não
  // servem para nada, e um formato que o Asaas recuse derrubaria a cobrança.
  const novo = await asaas('POST', '/customers', {
    name: p.nome, cpfCnpj: doc, externalReference: p.ref, notificationDisabled: true,
    ...(p.comContato ? { email: p.email || undefined } : {}),
  })
  return novo.id
}

export async function criarCobrancaAsaas(input: CobrancaSessaoInput): Promise<CobrancaCriada> {
  // Asaas não tem débito online (spike: só existe na tabela de taxas). Até a
  // Fase 3 tirar o DÉBITO do WhatsApp, vira crédito à vista — o paciente paga
  // na fatura com cartão.
  const metodo: MetodoSessao = input.metodo === 'debito' ? 'credito' : input.metodo
  if (input.metodo === 'debito') log.warn('asaas.cobranca', `sessao=${input.sessaoId.slice(0, 8)}: DÉBITO pedido — Asaas não tem débito, cobrando no crédito à vista`)
  const parcelas = metodo === 'credito' ? Math.min(6, Math.max(1, Math.round(input.parcelas ?? 1))) : 1

  const customer = await garantirCustomer({
    ref: `paciente:${input.paciente.id}`, nome: input.paciente.nome, cpfCnpj: input.paciente.cpf,
  })

  const hoje = hojeSP()
  const venc = input.dataSessao ? dataSP(input.dataSessao) : hoje
  const valor = paraReais(input.valorCentavos)
  const descricao = `Sessão de psicoterapia ${input.sessaoId.slice(0, 8)}`

  // 1. Cria SEM split — o líquido (netValue) vem na resposta.
  const pay = await asaas('POST', '/payments', {
    customer,
    billingType: metodo === 'pix' ? 'PIX' : 'CREDIT_CARD',
    dueDate: venc < hoje ? hoje : venc,
    description: descricao,
    externalReference: refSessao(input.sessaoId),
    ...(parcelas > 1 ? { installmentCount: parcelas, totalValue: valor } : { value: valor }),
  })
  const parcelamentoId: string | null = pay.installment ?? null

  // 2. Split (D-01). Falhou → cobrança segue SEM split (RF-PG-24) com alerta:
  //    melhor o dinheiro ficar na raiz (repasse manual) que o paciente sem cobrança.
  let taxaAdmCentavos = 0
  const wallet = input.recebedor?.gateway === 'asaas' ? input.recebedor.walletId : null
  if (wallet) {
    try {
      if (parcelamentoId) {
        const lista = await asaas('GET', `/payments?installment=${parcelamentoId}&limit=100`)
        const liquido = (lista?.data ?? []).reduce((a: number, x: any) => a + paraCentavos(x.netValue), 0)
        const s = splitSobreLiquido(input.valorCentavos, liquido)
        if (s) {
          await asaas('PUT', `/installments/${parcelamentoId}/splits`, {
            splits: [{ walletId: wallet, totalFixedValue: paraReais(s.psicologoCentavos), externalReference: refSessao(input.sessaoId) }],
          })
          taxaAdmCentavos = s.taxaAdmCentavos
        }
      } else {
        const s = splitSobreLiquido(input.valorCentavos, paraCentavos(pay.netValue))
        if (s) {
          await asaas('PUT', `/payments/${pay.id}`, {
            split: [{ walletId: wallet, fixedValue: paraReais(s.psicologoCentavos), externalReference: refSessao(input.sessaoId) }],
          })
          taxaAdmCentavos = s.taxaAdmCentavos
        }
      }
      if (!taxaAdmCentavos) log.warn('asaas.cobranca', `sessao=${input.sessaoId.slice(0, 8)}: valor baixo demais para split — SEM split`)
    } catch (err) {
      log.err('asaas.cobranca', `sessao=${input.sessaoId.slice(0, 8)} cobrança ${pay.id}: split NÃO gravado — valor inteiro fica na raiz (repasse manual)`, err instanceof Error ? err.message : err)
      taxaAdmCentavos = 0
    }
  } else {
    log.warn('asaas.cobranca', `sessao=${input.sessaoId.slice(0, 8)}: psicólogo sem subconta Asaas — cobrança SEM split (valor fica na raiz)`)
  }

  // 3. PIX: copia e cola. A fatura (invoiceUrl) mostra QR + copia e cola e é o
  //    link que vai no WhatsApp; vale para os dois métodos.
  let qrCode: string | null = null
  if (metodo === 'pix') {
    const qr = await asaas('GET', `/payments/${pay.id}/pixQrCode`)
    qrCode = qr?.payload ?? null
    if (!qrCode) throw new Error('asaas_pix_sem_qr')
  }

  return {
    gateway: 'asaas',
    cobrancaId: pay.id,
    parcelamentoId,
    qrCode,
    qrCodeUrl: metodo === 'pix' ? pay.invoiceUrl : null,
    url: pay.invoiceUrl ?? null,
    // Validade da REGRA DE NEGÓCIO (D-05): o QR do Asaas vale 1 ano; quem
    // expira em 30 min somos nós (cron cancela — Fase 3).
    venceEm: new Date(Date.now() + (metodo === 'pix' ? MIN_PIX : MIN_CARTAO)).toISOString(),
    taxaAdmCentavos,
    parcelas,
    metodo,
  }
}

/**
 * Estorno (spike §7). Sempre com `splitRefunds` explícito: sem ele o Asaas tira
 * só da parte da raiz e o parcial falha. Exige saldo na raiz ≥ valor (D-08) e,
 * no PIX, autorização de evento crítico no painel (D-09) → 'solicitado'.
 */
export async function reembolsarAsaas(input: ReembolsoInput): Promise<ReembolsoResultado> {
  try {
    if (input.parcelamentoId && !input.valorCentavos) {
      await asaas('POST', `/installments/${input.parcelamentoId}/refund`, {})
      return { status: 'estornado' }
    }
    const pay = await asaas('GET', `/payments/${input.cobrancaId}`)
    const bruto = paraCentavos(pay.value)
    const valor = input.valorCentavos ?? bruto
    const splits: any[] = (pay.split ?? []).filter((s: any) => s.status !== 'CANCELLED' && s.status !== 'REFUNDED')
    const splitRefunds = splits.map((s: any) => ({
      id: s.id,
      value: paraReais(valor >= bruto
        ? paraCentavos(s.totalValue ?? s.fixedValue)
        : Math.round(paraCentavos(s.totalValue ?? s.fixedValue) * valor / bruto)),
    }))
    await asaas('POST', `/payments/${input.cobrancaId}/refund`, {
      value: paraReais(valor),
      description: 'Cancelamento de sessão (Audere)',
      ...(splitRefunds.length ? { splitRefunds } : {}),
    })
    const ref = await asaas('GET', `/payments/${input.cobrancaId}/refunds`).catch(() => null)
    const ultimo = ref?.data?.[ref.data.length - 1]
    if (ultimo?.status === 'AWAITING_CRITICAL_ACTION_AUTHORIZATION') return { status: 'solicitado' }
    return { status: 'estornado' }
  } catch (err) {
    if (err instanceof AsaasErro && err.tem(/saldo|tente novamente|alguns instantes/i)) {
      log.warn('asaas.cobranca', `estorno de ${input.cobrancaId} adiado: ${err.descricao}`)
      return { status: 'pendente', motivo: err.descricao }
    }
    const motivo = err instanceof AsaasErro ? err.descricao : (err as Error).message
    log.err('asaas.cobranca', `estorno de ${input.cobrancaId} falhou: ${motivo}`, undefined)
    return { status: 'falhou', motivo }
  }
}

/**
 * Cancela (DELETE) uma cobrança ainda não paga — D-05: a validade de 30 min do
 * PIX é regra nossa. 404 = já não existe (ok). Cobrança já recebida o Asaas
 * recusa com 400 → `false`, e quem chamou não mexe no status (o webhook de
 * pagamento é que manda).
 */
export async function cancelarCobrancaAsaas(cobrancaId: string): Promise<boolean> {
  try {
    await asaas('DELETE', `/payments/${encodeURIComponent(cobrancaId)}`)
    return true
  } catch (err) {
    if (err instanceof AsaasErro && err.status === 404) return true
    log.warn('asaas', `não cancelou a cobrança ${cobrancaId}: ${err instanceof AsaasErro ? err.descricao : (err as Error).message}`)
    return false
  }
}
