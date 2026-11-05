/**
 * Spike da Fase 0 da migração para o Asaas (docs/asaas/tasks.md).
 *
 * Roda SÓ contra o sandbox (recusa se ASAAS_API_URL não for api-sandbox) e
 * registra as respostas reais para o docs/asaas/spike.md.
 *
 *   npm run asaas:spike                       # todas as etapas
 *   npm run asaas:spike -- d01 estorno        # só algumas
 *   npm run asaas:spike -- --sem-webhook      # sem listener/ngrok
 *
 * Etapas: conta, notificacao, subcontas, split-pre, aprovacao, d01, d03, d04,
 *         estorno, webhook, pendencias (fora do padrão: follow-up manual/temporal)
 *
 * Webhook: sobe um listener HTTP local e um túnel — `cloudflared` se
 * ASAAS_SPIKE_CLOUDFLARED=<caminho do binário>, senão `ngrok http` (binário em
 * ASAAS_SPIKE_NGROK se o do PATH for antigo — a conta exige agente ≥ 3.28) (ou usa
 * ASAAS_SPIKE_WEBHOOK_URL), cria um webhook TEMPORÁRIO na conta raiz e o
 * remove no fim. A 1ª entrega de "pago" (CONFIRMED/RECEIVED) recebe 500 de propósito,
 * para observar o reenvio (at least once) e se o `id` do evento se mantém.
 *
 * Segredos: a chave da raiz e as apiKeys das subcontas NUNCA são impressas.
 * O log redigido e o estado (com as apiKeys das subcontas, para reuso entre
 * execuções) ficam em os.tmpdir()/audere-asaas-spike — fora do repositório.
 *
 * ⚠️ A conta sandbox é compartilhada com o BolsoAI: não mexer nos webhooks
 *    que não forem criados por este script (nome começa com "audere-spike").
 */
import { createServer, type IncomingMessage } from 'node:http'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Configuração ─────────────────────────────────────────────────────────
const BASE = (process.env.ASAAS_API_URL || '').replace(/\/$/, '')
const CHAVE_RAIZ = (process.env.ASAAS_API_KEY || '').replace(/^\\\$/, '$') // aceita "\$aact_" (escape p/ o Next)
const PORTA = Number(process.env.ASAAS_SPIKE_PORT || 4799)
const ESPERA_REENVIO_S = Number(process.env.ASAAS_SPIKE_WAIT_S || 240)
const EMAIL_BASE = process.env.ASAAS_SPIKE_EMAIL || 'spike.asaas@audere.ia.br'
const DIR = join(tmpdir(), 'audere-asaas-spike')
const ARQ_ESTADO = join(DIR, 'estado.json')
const ARQ_LOG = join(DIR, `log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
const ARQ_RESULT = ARQ_LOG.replace('log-', 'resultado-')
const TAXA_ADM_PCT = 0.025 // espelha COMISSAO_SESSAO_PCT de planos.ts

if (!BASE.includes('api-sandbox.asaas.com')) {
  console.error(`Recusado: ASAAS_API_URL não é o sandbox (${BASE || 'vazio'}).`)
  process.exit(1)
}
if (!CHAVE_RAIZ) { console.error('ASAAS_API_KEY ausente.'); process.exit(1) }
mkdirSync(DIR, { recursive: true })

// ── Estado entre execuções (fora do repo) ───────────────────────────────
type Subconta = { id: string; walletId: string; apiKey: string; cpfCnpj: string; tipo: 'PF' | 'PJ' }
type Estado = {
  subPF?: Subconta; subPJ?: Subconta; clienteSemNotif?: string; clienteComNotif?: string; clientePsi?: string
  // follow-up (etapa pendencias)
  linkId?: string; assinaturaApi?: string; assinaturaFatura?: string
}
const estado: Estado = existsSync(ARQ_ESTADO) ? JSON.parse(readFileSync(ARQ_ESTADO, 'utf8')) : {}
const salvarEstado = () => writeFileSync(ARQ_ESTADO, JSON.stringify(estado, null, 2), { mode: 0o600 })

// ── Log redigido ────────────────────────────────────────────────────────
const log: unknown[] = []
const CHAVES_SECRETAS = new Set(['apiKey', 'access_token', 'authToken', 'accessToken', 'number', 'ccv', 'creditCardToken'])
function redigir(v: unknown, chave = ''): unknown {
  if (Array.isArray(v)) return v.map(x => redigir(x))
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, redigir(x, k)]))
  }
  if (typeof v === 'string') {
    if (CHAVES_SECRETAS.has(chave)) return v ? `«redigido:${v.length}»` : v
    if (chave === 'cpfCnpj' && v.length >= 11) return `${v.slice(0, 3)}…${v.slice(-2)}`
    if ((chave === 'encodedImage' || chave === 'payload') && v.length > 60) return `${v.slice(0, 40)}…(${v.length})`
  }
  return v
}

// ── Cliente HTTP ────────────────────────────────────────────────────────
type Resp<T = any> = { status: number; ok: boolean; body: T; ms: number }
async function api<T = any>(metodo: string, caminho: string, corpo?: unknown, chave = CHAVE_RAIZ, rotulo = ''): Promise<Resp<T>> {
  const t0 = Date.now()
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'Audere-spike/1.0' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(60_000),
  })
  const texto = await r.text()
  let body: any = texto
  try { body = texto ? JSON.parse(texto) : null } catch { /* texto puro */ }
  const ms = Date.now() - t0
  const quem = chave === CHAVE_RAIZ ? 'raiz' : 'subconta'
  log.push({ em: new Date().toISOString(), quem, rotulo, metodo, caminho, status: r.status, ms, corpo: redigir(corpo), resposta: redigir(body) })
  const erro = !r.ok && body?.errors ? ` → ${body.errors.map((e: any) => `${e.code}: ${e.description}`).join(' | ')}` : ''
  console.log(`  ${r.ok ? '·' : '!'} [${quem}] ${metodo} ${caminho.split('?')[0]} ${r.status} (${ms}ms)${erro}`)
  return { status: r.status, ok: r.ok, body, ms }
}

// ── Resultados ──────────────────────────────────────────────────────────
type Resultado = { etapa: string; conclusao: string; achados: string[]; dados: Record<string, unknown> }
const resultados: Resultado[] = []
let atual: Resultado
function etapa(nome: string) {
  atual = { etapa: nome, conclusao: '', achados: [], dados: {} }
  resultados.push(atual)
  console.log(`\n━━ ${nome} ━━`)
}
function achado(t: string) { atual.achados.push(t); console.log(`  → ${t}`) }
function concluir(t: string) { atual.conclusao = t; console.log(`  ✔ ${t}`) }
const dado = (k: string, v: unknown) => { atual.dados[k] = redigir(v) }

// ── Utilidades ──────────────────────────────────────────────────────────
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))
const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10) // America/Sao_Paulo
const emDias = (d: number) => new Date(Date.now() - 3 * 3600_000 + d * 86400_000).toISOString().slice(0, 10)
const r2 = (n: number) => Math.round(n * 100) / 100
const tag = () => randomBytes(3).toString('hex')

function dvMod11(base: string, pesos: number[]) {
  const s = base.split('').reduce((a, d, i) => a + Number(d) * pesos[i], 0)
  const r = s % 11
  return r < 2 ? 0 : 11 - r
}
function gerarCpf() {
  let b = ''; for (let i = 0; i < 9; i++) b += Math.floor(Math.random() * 10)
  const d1 = dvMod11(b, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = dvMod11(b + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return b + d1 + d2
}
function gerarCnpj() {
  let b = ''; for (let i = 0; i < 8; i++) b += Math.floor(Math.random() * 10)
  b += '0001'
  const d1 = dvMod11(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = dvMod11(b + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return b + d1 + d2
}
function gerarCartaoTeste() { // Visa com Luhn válido (o sandbox aprova número fictício válido)
  const d = [4, ...Array.from({ length: 14 }, () => Math.floor(Math.random() * 10))]
  let s = 0
  for (let i = 0; i < 15; i++) { let x = d[14 - i]; if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9 } s += x }
  return [...d, (10 - (s % 10)) % 10].join('')
}
const emailUnico = (t: string) => EMAIL_BASE.replace('@', `+${t}@`)
const ENDERECO = { address: 'Av. Paulista', addressNumber: '1000', complement: 'Sala 1', province: 'Bela Vista', postalCode: '01310100' }

// ── Webhook: listener + túnel ───────────────────────────────────────────
type Entrega = { em: string; idEvento: string; evento: string; token: string | null; tokenConfere: boolean; respondido: number; recurso?: string; corpo: unknown }
const entregas: Entrega[] = []
const TOKEN_WEBHOOK = randomBytes(24).toString('hex') // 48 chars, gerado por nós
const forcarFalha = new Set<string>() // ids de cobrança cuja 1ª entrega de "pago" responde 500
// No sandbox o PIX confirmado vai direto para PAYMENT_RECEIVED (sem CONFIRMED).
const PAGO = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const falhasForcadas = new Set<string>() // ids de evento que já receberam 500
let urlPublica = ''
let tunel: ChildProcess | null = null
let webhookRaizId = ''

function lerCorpo(req: IncomingMessage) {
  return new Promise<string>(res => { let s = ''; req.on('data', c => (s += c)); req.on('end', () => res(s)) })
}
async function subirWebhook(): Promise<boolean> {
  const server = createServer(async (req, res) => {
    const corpo = await lerCorpo(req)
    let j: any = {}
    try { j = JSON.parse(corpo) } catch { /* ignora */ }
    const token = (req.headers['asaas-access-token'] as string) ?? null
    const recurso = j.payment?.id ?? j.subscription?.id ?? j.account?.id ?? j.accountStatus?.id
    let status = 200
    if (PAGO.has(j.event) && forcarFalha.has(j.payment?.id) && !falhasForcadas.has(j.id)) {
      falhasForcadas.add(j.id); status = 500
    }
    entregas.push({ em: new Date().toISOString(), idEvento: j.id, evento: j.event, token: token ? `«${token.length} chars»` : null, tokenConfere: token === TOKEN_WEBHOOK, respondido: status, recurso, corpo: redigir(j) })
    console.log(`  ⇠ webhook ${j.event} ${j.id} (${recurso ?? '-'}) → ${status}`)
    res.writeHead(status, { 'Content-Type': 'application/json' }).end('{}')
  })
  await new Promise<void>(r => server.listen(PORTA, r))
  server.unref()

  urlPublica = process.env.ASAAS_SPIKE_WEBHOOK_URL || ''
  const cloudflared = process.env.ASAAS_SPIKE_CLOUDFLARED
  if (!urlPublica && cloudflared) {
    // quick tunnel (sem conta): a URL https://*.trycloudflare.com sai no stderr
    tunel = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORTA}`], { stdio: ['ignore', 'ignore', 'pipe'] })
    urlPublica = await new Promise<string>(res => {
      const t = setTimeout(() => res(''), 30_000)
      tunel!.stderr!.on('data', (c: Buffer) => {
        const m = c.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
        if (m) { clearTimeout(t); res(m[0]) }
      })
    })
    if (urlPublica) await esperar(5000) // DNS do quick tunnel propaga em alguns segundos
  }
  if (!urlPublica) {
    tunel = spawn(process.env.ASAAS_SPIKE_NGROK || 'ngrok', ['http', String(PORTA), '--log=stdout'], { stdio: 'ignore', shell: process.platform === 'win32' })
    for (let i = 0; i < 20 && !urlPublica; i++) {
      await esperar(750)
      try {
        const t = await (await fetch('http://127.0.0.1:4040/api/tunnels')).json() as any
        urlPublica = t.tunnels?.find((x: any) => x.public_url?.startsWith('https'))?.public_url ?? ''
      } catch { /* ngrok ainda subindo */ }
    }
  }
  if (!urlPublica) { console.log('  ! sem URL pública (túnel não subiu) — etapas de webhook ficam sem evidência'); return false }
  urlPublica = urlPublica.replace(/\/$/, '') + '/asaas'
  console.log(`  webhook local :${PORTA} ⇢ ${urlPublica}`)
  return true
}
const ehUrlSpike = () => !!urlPublica

const EVENTOS_RAIZ = [
  'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE',
  'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_SPLIT_CANCELLED', 'PAYMENT_SPLIT_DIVERGENCE_BLOCK', 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
  'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED',
]
const EVENTOS_CONTA = [
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED', 'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING', 'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED', 'ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING', 'ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED',
  'ACCOUNT_STATUS_DOCUMENT_APPROVED', 'ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_DOCUMENT_PENDING', 'ACCOUNT_STATUS_DOCUMENT_REJECTED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', 'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING', 'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
]
const cfgWebhook = (nome: string, eventos: string[]) => ({
  name: nome, url: urlPublica, email: EMAIL_BASE, enabled: true, interrupted: false,
  apiVersion: 3, authToken: TOKEN_WEBHOOK, sendType: 'SEQUENTIALLY', events: eventos,
})

async function criarWebhookRaiz() {
  const r = await api('POST', '/webhooks', cfgWebhook(`audere-spike-${tag()}`, EVENTOS_RAIZ), CHAVE_RAIZ, 'webhook raiz')
  if (r.ok) webhookRaizId = r.body.id
  return r
}
async function removerWebhookRaiz() {
  if (webhookRaizId) await api('DELETE', `/webhooks/${webhookRaizId}`, undefined, CHAVE_RAIZ, 'remover webhook raiz')
}
async function aguardarEvento(pred: (e: Entrega) => boolean, ms = 30_000) {
  if (!ehUrlSpike()) return undefined
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const e = entregas.find(pred); if (e) return e; await esperar(1000) }
  return undefined
}

// ── Blocos reutilizáveis ────────────────────────────────────────────────
async function cliente(chaveEstado: 'clienteSemNotif' | 'clienteComNotif' | 'clientePsi', notificationDisabled: boolean, nome: string) {
  if (estado[chaveEstado]) return estado[chaveEstado]!
  const r = await api('POST', '/customers', {
    name: nome, cpfCnpj: gerarCpf(), email: emailUnico(`cli-${tag()}`), mobilePhone: '11987654321',
    externalReference: `spike-${chaveEstado}`, notificationDisabled,
  })
  if (!r.ok) throw new Error(`criar customer falhou: ${JSON.stringify(r.body)}`)
  estado[chaveEstado] = r.body.id; salvarEstado()
  return r.body.id as string
}

function corpoSubconta(tipo: 'PF' | 'PJ', t = tag(), cpfCnpj = tipo === 'PF' ? gerarCpf() : gerarCnpj()) {
  return {
    name: tipo === 'PF' ? `Psicóloga Spike ${t}` : `Clínica Spike ${t} Ltda`,
    email: emailUnico(`sub-${t}`), cpfCnpj, mobilePhone: '11987654321', incomeValue: 8000, ...ENDERECO,
    ...(tipo === 'PF' ? { birthDate: '1990-05-10' } : { companyType: 'LIMITED' }),
  } as Record<string, unknown>
}
async function criarSubconta(tipo: 'PF' | 'PJ', comWebhook: boolean) {
  const t = tag()
  const corpo = corpoSubconta(tipo, t)
  const cpfCnpj = corpo.cpfCnpj as string
  if (comWebhook && ehUrlSpike()) corpo.webhooks = [cfgWebhook(`audere-spike-sub-${t}`, [...EVENTOS_CONTA, ...EVENTOS_RAIZ.filter(e => e.startsWith('PAYMENT_'))])]
  let r = await api('POST', '/accounts', corpo, CHAVE_RAIZ, `subconta ${tipo}`)
  if (!r.ok && corpo.webhooks) {
    achado(`POST /accounts com webhooks recusado (${r.status}): ${JSON.stringify(r.body?.errors)} — tentando sem webhooks`)
    delete corpo.webhooks
    r = await api('POST', '/accounts', corpo, CHAVE_RAIZ, `subconta ${tipo} sem webhook`)
  }
  return { r, cpfCnpj, corpo }
}

async function statusConta(apiKey: string) {
  const r = await api('GET', '/myAccount/status', undefined, apiKey, 'status subconta')
  return r.body
}

async function pagamentoPix(valor: number, split?: unknown[], descricao = 'Sessão spike') {
  const customer = await cliente('clienteSemNotif', true, 'Paciente Spike (sem notificação)')
  return api('POST', '/payments', {
    customer, billingType: 'PIX', value: valor, dueDate: hoje(), description: descricao,
    externalReference: `spike-${tag()}`, ...(split ? { split } : {}),
  }, CHAVE_RAIZ, descricao)
}
const confirmarSandbox = (id: string) => api('POST', `/sandbox/payment/${id}/confirm`, {}, CHAVE_RAIZ, 'confirmar (sandbox)')
const saldo = async (chave = CHAVE_RAIZ) => Number((await api('GET', '/finance/balance', undefined, chave, 'saldo')).body?.balance ?? NaN)
const lerPagamento = (id: string) => api('GET', `/payments/${id}`)

async function cartaoPagar(paymentId: string) {
  return api('POST', `/payments/${paymentId}/payWithCreditCard`, {
    creditCard: { holderName: 'PACIENTE SPIKE', number: gerarCartaoTeste(), expiryMonth: '12', expiryYear: String(new Date().getFullYear() + 3), ccv: '123' },
    creditCardHolderInfo: { name: 'Paciente Spike', email: emailUnico('cc'), cpfCnpj: gerarCpf(), postalCode: ENDERECO.postalCode, addressNumber: '1000', phone: '11987654321' },
  }, CHAVE_RAIZ, 'pagar com cartão')
}

/** Split exato da regra Audere: psicólogo = líquido − 2,5% do bruto. */
function splitAudere(valor: number, liquido: number, walletId: string) {
  const taxaAdm = r2(valor * TAXA_ADM_PCT)
  return { taxaAdm, split: [{ walletId, fixedValue: r2(liquido - taxaAdm), externalReference: 'spike-psicologo' }] }
}

async function precisaSubconta(): Promise<Subconta> {
  if (estado.subPF) return estado.subPF
  const { r, cpfCnpj } = await criarSubconta('PF', true)
  if (!r.ok) throw new Error('não foi possível criar subconta PF')
  estado.subPF = { id: r.body.id, walletId: r.body.walletId, apiKey: r.body.accessToken?.apiKey ?? r.body.apiKey, cpfCnpj, tipo: 'PF' }
  salvarEstado()
  return estado.subPF
}

// ── Etapas ──────────────────────────────────────────────────────────────
const ETAPAS: Record<string, () => Promise<void>> = {
  async conta() {
    etapa('conta')
    const me = await api('GET', '/myAccount')
    const st = await api('GET', '/myAccount/status')
    const fees = await api('GET', '/myAccount/fees')
    const pix = await api('GET', '/pix/addressKeys')
    const wh = await api('GET', '/webhooks')
    dado('status', st.body)
    dado('taxas', { pix: fees.body?.payment?.pix, creditCard: fees.body?.payment?.creditCard, debitCard: fees.body?.payment?.debitCard })
    achado(`raiz ${me.body?.personType}/${me.body?.companyType}, status ${me.body?.status}, general=${st.body?.general}`)
    achado(`chaves PIX: ${pix.body?.data?.map((k: any) => `${k.type}/${k.status}`).join(', ') || 'nenhuma'}`)
    achado(`webhooks pré-existentes: ${wh.body?.data?.map((w: any) => w.name).join(', ') || 'nenhum'} (não mexer)`)
    const p = fees.body?.payment
    achado(`tarifa PIX ${p?.pix?.fixedFeeValue} (com desconto ${p?.pix?.fixedFeeValueWithDiscount} até ${p?.pix?.discountExpiration}); cartão 1x ${p?.creditCard?.oneInstallmentPercentage}% + ${p?.creditCard?.operationValue} (desconto ${p?.creditCard?.discountOneInstallmentPercentage}%), 2–6x ${p?.creditCard?.upToSixInstallmentsPercentage}%`)
    concluir('conta raiz lida')
  },

  async notificacao() {
    etapa('notificacao')
    const semId = await cliente('clienteSemNotif', true, 'Paciente Spike (sem notificação)')
    const comId = await cliente('clienteComNotif', false, 'Paciente Spike (com notificação)')
    const resumo = async (id: string) => {
      const r = await api('GET', `/customers/${id}/notifications`)
      return (r.body?.data ?? []).map((n: any) => ({ evento: n.event, ativo: n.enabled, emailCliente: n.emailEnabledForCustomer, smsCliente: n.smsEnabledForCustomer, whatsCliente: n.whatsappEnabledForCustomer }))
    }
    const sem = await resumo(semId); const com = await resumo(comId)
    dado('sem', sem); dado('com', com)
    const algumLigado = (l: any[]) => l.some(n => n.ativo && (n.emailCliente || n.smsCliente || n.whatsCliente))
    achado(`customer notificationDisabled=true → ${sem.length} notificações; alguma ativa ao cliente? ${algumLigado(sem)}`)
    achado(`customer notificationDisabled=false → ${com.length} notificações; alguma ativa ao cliente? ${algumLigado(com)}`)
    // Cinto e suspensório: desligar cada notificação explicitamente
    const lista = (await api('GET', `/customers/${semId}/notifications`)).body?.data ?? []
    const batch = await api('PUT', '/notifications/batch', {
      customer: semId,
      notifications: lista.map((n: any) => ({ id: n.id, enabled: false, emailEnabledForCustomer: false, smsEnabledForCustomer: false, phoneCallEnabledForCustomer: false, whatsappEnabledForCustomer: false, emailEnabledForProvider: false, smsEnabledForProvider: false })),
    }, CHAVE_RAIZ, 'desligar notificações')
    const depois = await resumo(semId)
    achado(`PUT /notifications/batch (tudo false) → ${batch.status}; alguma ativa depois? ${algumLigado(depois)} ${batch.ok ? '' : JSON.stringify(batch.body?.errors)}`)
    const c = await api('GET', `/customers/${semId}`)
    achado(`GET customer devolve notificationDisabled=${c.body?.notificationDisabled}`)
    concluir(algumLigado(sem) ? 'notificationDisabled NÃO desliga tudo — ver dados' : 'notificationDisabled=true deixa as notificações ao cliente desligadas')
  },

  async subcontas() {
    etapa('subcontas')
    // Campos obrigatórios: manda vazio e lê os erros
    const vazio = await api('POST', '/accounts', {}, CHAVE_RAIZ, 'subconta vazia')
    dado('errosCorpoVazio', vazio.body?.errors)
    achado(`POST /accounts {} → ${vazio.status}: ${vazio.body?.errors?.map((e: any) => e.description).join(' | ')}`)

    for (const tipo of ['PF', 'PJ'] as const) {
      const chave = tipo === 'PF' ? 'subPF' : 'subPJ'
      if (estado[chave]) { achado(`subconta ${tipo} reaproveitada do estado (${estado[chave]!.id})`); continue }
      const { r, cpfCnpj } = await criarSubconta(tipo, true)
      dado(`criacao${tipo}`, r.body)
      if (!r.ok) { achado(`subconta ${tipo} falhou: ${JSON.stringify(r.body?.errors)}`); continue }
      const apiKey = r.body.accessToken?.apiKey ?? r.body.apiKey
      estado[chave] = { id: r.body.id, walletId: r.body.walletId, apiKey, cpfCnpj, tipo }; salvarEstado()
      achado(`subconta ${tipo} criada em ${r.ms}ms: id=${r.body.id} walletId=${r.body.walletId} apiKey em ${r.body.accessToken ? 'accessToken.apiKey' : r.body.apiKey ? 'apiKey (topo)' : 'NENHUM lugar'}`)
      achado(`campos da resposta ${tipo}: ${Object.keys(r.body).join(', ')}`)
      // Idempotência
      const f = await api('GET', `/accounts?cpfCnpj=${cpfCnpj}`)
      achado(`GET /accounts?cpfCnpj= → totalCount=${f.body?.totalCount} (id bate? ${f.body?.data?.[0]?.id === r.body.id})`)
      const fw = await api('GET', `/accounts?walletId=${r.body.walletId}`)
      achado(`GET /accounts?walletId= → totalCount=${fw.body?.totalCount}`)
      // Duplicar com o mesmo CPF/CNPJ
      const dup = await api('POST', '/accounts', corpoSubconta(tipo, tag(), cpfCnpj), CHAVE_RAIZ, 'duplicada').catch(() => null)
      if (dup) achado(`criar de novo com o mesmo ${tipo === 'PF' ? 'CPF' : 'CNPJ'} → ${dup.status} ${dup.ok ? '(ACEITOU: duplicou!)' : JSON.stringify(dup.body?.errors)}`)
      if (apiKey) {
        const st = await statusConta(apiKey)
        dado(`status${tipo}`, st)
        achado(`status inicial ${tipo}: ${JSON.stringify(st)}`)
      }
    }
    // Nova apiKey para subconta (recuperação se a 1ª for perdida)
    if (estado.subPF) {
      const k = await api('GET', `/accounts/${estado.subPF.id}/accessTokens`, undefined, CHAVE_RAIZ, 'listar chaves subconta')
      achado(`GET /accounts/{id}/accessTokens → ${k.status} ${k.ok ? `(${k.body?.data?.length ?? '?'} chaves)` : JSON.stringify(k.body?.errors)}`)
    }
    concluir('subcontas PF/PJ testadas')
  },

  async 'split-pre'() {
    etapa('split-pre')
    if (!estado.subPJ) { achado('sem subconta PJ no estado — rode a etapa subcontas antes'); return }
    const st = await statusConta(estado.subPJ.apiKey)
    achado(`subconta PJ (não aprovada): general=${st?.general}`)
    const r = await pagamentoPix(10, [{ walletId: estado.subPJ.walletId, fixedValue: 5 }], 'Split p/ subconta não aprovada')
    dado('criacao', r.body)
    if (!r.ok) { concluir(`split para subconta não aprovada RECUSADO na criação: ${JSON.stringify(r.body?.errors)}`); return }
    achado(`criação aceita; split[0].status=${r.body.split?.[0]?.status}`)
    const c = await confirmarSandbox(r.body.id)
    achado(`confirmar → ${c.status} status=${c.body?.status}`)
    await esperar(3000)
    const p = await lerPagamento(r.body.id)
    dado('depois', p.body)
    achado(`após pago: status=${p.body?.status} split=${JSON.stringify(p.body?.split?.map((s: any) => ({ status: s.status, fixedValue: s.fixedValue, motivo: s.refusalReason ?? s.cancellationReason })))}`)
    const saldoPJ = await saldo(estado.subPJ.apiKey)
    achado(`saldo da subconta PJ não aprovada: ${saldoPJ}`)
    concluir(`split antes da aprovação: criação aceita, split ficou ${p.body?.split?.[0]?.status}`)
  },

  async aprovacao() {
    etapa('aprovacao')
    // Com túnel: subconta NOVA com webhook, para ver os ACCOUNT_STATUS_* chegarem.
    let sub: Subconta
    if (ehUrlSpike()) {
      const { r, cpfCnpj, corpo } = await criarSubconta('PF', true)
      if (!r.ok) throw new Error(`subconta p/ aprovação falhou: ${JSON.stringify(r.body?.errors)}`)
      achado(`subconta nova ${r.body.id} criada ${corpo.webhooks ? 'COM' : 'SEM'} webhook`)
      sub = { id: r.body.id, walletId: r.body.walletId, apiKey: r.body.accessToken?.apiKey, cpfCnpj, tipo: 'PF' }
      await esperar(8000) // deixa chegar os eventos da criação antes de aprovar
      achado(`eventos após criar (antes de aprovar): ${entregas.filter(e => e.evento?.startsWith('ACCOUNT_STATUS_')).map(e => e.evento).join(', ') || 'nenhum'}`)
    } else sub = await precisaSubconta()
    const antes = await statusConta(sub.apiKey)
    achado(`antes: ${JSON.stringify(antes)}`)
    // Logo após a criação (commercialInfo ainda AWAITING_APPROVAL) o approve devolve 500: retenta
    let a = await api('POST', '/sandbox/myAccount/approve', {}, sub.apiKey, 'aprovar subconta (sandbox)')
    for (let i = 1; !a.ok && a.status >= 500 && i <= 4; i++) {
      achado(`approve → ${a.status} ${a.body?.errors?.[0]?.code}; retentativa ${i} em 15s`)
      await esperar(15_000)
      a = await api('POST', '/sandbox/myAccount/approve', {}, sub.apiKey, 'aprovar subconta (sandbox)')
    }
    achado(`POST /sandbox/myAccount/approve (apiKey da subconta) → ${a.status} ${a.ok ? '' : JSON.stringify(a.body?.errors)}`)
    await esperar(4000)
    const depois = await statusConta(sub.apiKey)
    dado('depois', depois)
    achado(`depois: ${JSON.stringify(depois)}`)
    const nAntes = entregas.length
    const ev = await aguardarEvento(e => e.evento === 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', 40_000)
    void nAntes
    const contas = entregas.filter(e => e.evento?.startsWith('ACCOUNT_STATUS_'))
    dado('eventosConta', contas.map(e => ({ evento: e.evento, id: e.idEvento, corpo: e.corpo })))
    achado(ev ? `eventos ACCOUNT_STATUS_* recebidos: ${contas.map(e => e.evento).join(', ')}` : 'nenhum ACCOUNT_STATUS_* recebido em 20s')
    concluir(`aprovação: general ${antes?.general} → ${depois?.general}`)
  },

  async d01() {
    etapa('d01')
    const sub = await precisaSubconta()
    const valor = 10
    // (b) previsão pela tabela de taxas
    const fees = (await api('GET', '/myAccount/fees')).body?.payment?.pix
    // (a) criar sem split, ler netValue, PUT com split
    const r = await pagamentoPix(valor, undefined, 'D-01 sessão R$10')
    if (!r.ok) { concluir('criação falhou'); return }
    const id = r.body.id
    achado(`criada sem split: value=${r.body.value} netValue=${r.body.netValue} (tabela: fixo ${fees?.fixedFeeValue}, c/ desconto ${fees?.fixedFeeValueWithDiscount})`)
    const { taxaAdm, split } = splitAudere(valor, r.body.netValue, sub.walletId)
    let put = await api('PUT', `/lean/payments/${id}`, { split }, CHAVE_RAIZ, 'PUT lean split')
    achado(`PUT /lean/payments/{id} {split} → ${put.status} ${put.ok ? `split=${JSON.stringify(put.body?.split?.map((s: any) => s.fixedValue))}` : JSON.stringify(put.body?.errors ?? put.body)}`)
    if (!put.ok || !put.body?.split?.length) {
      put = await api('PUT', `/payments/${id}`, { split }, CHAVE_RAIZ, 'PUT split')
      achado(`PUT /payments/{id} {split} → ${put.status} ${put.ok ? `split=${JSON.stringify(put.body?.split?.map((s: any) => s.fixedValue))}` : JSON.stringify(put.body?.errors)}`)
    }
    const conf = await lerPagamento(id)
    achado(`GET após PUT: split=${JSON.stringify(conf.body?.split?.map((s: any) => ({ walletId: s.walletId === sub.walletId, fixedValue: s.fixedValue, status: s.status })))}; netValue=${conf.body?.netValue}`)
    const pixQr = await api('GET', `/payments/${id}/pixQrCode`)
    achado(`pixQrCode: payload ${pixQr.body?.payload ? 'ok' : 'ausente'}, expirationDate=${pixQr.body?.expirationDate}`)
    dado('pixQrCode', pixQr.body)

    const raizAntes = await saldo(); const subAntes = await saldo(sub.apiKey)
    await confirmarSandbox(id)
    await esperar(5000)
    const raizDepois = await saldo(); const subDepois = await saldo(sub.apiKey)
    const pago = await lerPagamento(id)
    dado('pago', pago.body)
    const dRaiz = r2(raizDepois - raizAntes); const dSub = r2(subDepois - subAntes)
    achado(`pago: status=${pago.body?.status} netValue=${pago.body?.netValue} split.status=${pago.body?.split?.map((s: any) => s.status)}`)
    achado(`Δ saldo raiz = ${dRaiz} (esperado ${taxaAdm}) · Δ saldo psicólogo = ${dSub} (esperado ${split[0].fixedValue})`)
    // (b) split já na criação usando a tarifa da tabela
    const tarifaTabela = fees?.fixedFeeValueWithDiscount ?? fees?.fixedFeeValue
    const b = splitAudere(valor, r2(valor - tarifaTabela), sub.walletId)
    const rb = await pagamentoPix(valor, b.split, 'D-01 opção b')
    achado(`opção (b) split na criação c/ tarifa da tabela (${tarifaTabela}) → ${rb.status}; netValue=${rb.body?.netValue}; bate? ${rb.body?.netValue === r2(valor - tarifaTabela)}`)
    if (rb.ok) await api('DELETE', `/payments/${rb.body.id}`, undefined, CHAVE_RAIZ, 'apagar opção b')
    concluir(dRaiz === taxaAdm ? `(a) funciona: raiz ficou com exatamente ${taxaAdm} (2,5% do bruto)` : `(a) divergiu: raiz Δ${dRaiz} vs ${taxaAdm} — ver dados`)
  },

  async d03() {
    etapa('d03')
    const sub = await precisaSubconta()
    // (2) Link de pagamento com até 6x + split
    const link = await api('POST', '/paymentLinks', {
      name: 'Sessão spike (link)', billingType: 'CREDIT_CARD', chargeType: 'INSTALLMENT', maxInstallmentCount: 6,
      value: 300, dueDateLimitDays: 1, notificationEnabled: false,
      split: [{ walletId: sub.walletId, percentualValue: 90 }],
    }, CHAVE_RAIZ, 'link 6x c/ split')
    dado('link', link.body)
    achado(`POST /paymentLinks c/ split → ${link.status}; resposta tem split? ${link.body?.split !== undefined} ${link.ok ? `url=${link.body?.url}` : JSON.stringify(link.body?.errors)}`)
    if (link.ok) {
      estado.linkId = link.body.id; salvarEstado()
      const g = await api('GET', `/paymentLinks/${link.body.id}`)
      achado(`GET do link: campos=${Object.keys(g.body ?? {}).join(', ')}`)
    }
    // (1) Parcelado pela API: cria sem split, soma os netValue, PUT splits do parcelamento
    const customer = await cliente('clienteSemNotif', true, 'Paciente Spike (sem notificação)')
    const valor = 300; const parcelas = 3
    const p = await api('POST', '/payments', {
      customer, billingType: 'CREDIT_CARD', installmentCount: parcelas, totalValue: valor, dueDate: hoje(),
      description: 'D-03 sessão 3x', externalReference: `spike-${tag()}`,
    }, CHAVE_RAIZ, 'parcelado 3x')
    dado('parcelado', p.body)
    if (!p.ok) { concluir(`parcelado falhou: ${JSON.stringify(p.body?.errors)}`); return }
    const inst = p.body.installment
    achado(`parcelado criado: 1ª parcela ${p.body.id} value=${p.body.value} netValue=${p.body.netValue} installment=${inst}`)
    const lista = await api('GET', `/payments?installment=${inst}`)
    const liqTotal = r2((lista.body?.data ?? []).reduce((a: number, x: any) => a + x.netValue, 0))
    const taxaAdm = r2(valor * TAXA_ADM_PCT)
    achado(`parcelas: ${lista.body?.data?.length}; Σ netValue antes de pagar = ${liqTotal}`)
    const sp = await api('PUT', `/installments/${inst}/splits`, { splits: [{ walletId: sub.walletId, totalFixedValue: r2(liqTotal - taxaAdm) }] }, CHAVE_RAIZ, 'PUT splits parcelamento')
    achado(`PUT /installments/{id}/splits {totalFixedValue} → ${sp.status} ${sp.ok ? '' : JSON.stringify(sp.body?.errors)}`)
    // Alternativa: split na criação com totalFixedValue
    const p2 = await api('POST', '/payments', {
      customer, billingType: 'CREDIT_CARD', installmentCount: parcelas, totalValue: valor, dueDate: hoje(),
      description: 'D-03 sessão 3x (split na criação)', split: [{ walletId: sub.walletId, totalFixedValue: 250 }],
    }, CHAVE_RAIZ, 'parcelado c/ split')
    achado(`parcelado com split.totalFixedValue na criação → ${p2.status} split/parcela=${JSON.stringify(p2.body?.split?.map((s: any) => [s.fixedValue, s.totalFixedValue]))}`)
    if (p2.ok) await api('DELETE', `/installments/${p2.body.installment}`, undefined, CHAVE_RAIZ, 'apagar parcelado 2')

    const raizAntes = await saldo()
    const pay = await cartaoPagar(p.body.id)
    achado(`pagar 1ª parcela com cartão (API) → ${pay.status} status=${pay.body?.status} ${pay.ok ? '' : JSON.stringify(pay.body?.errors)}`)
    await esperar(5000)
    const depois = await api('GET', `/payments?installment=${inst}`)
    dado('parcelasDepois', depois.body?.data)
    achado(`depois: ${depois.body?.data?.map((x: any) => `${x.installmentNumber}:${x.status} net=${x.netValue} split=${x.split?.map((s: any) => `${s.fixedValue}/${s.status}`)}`).join(' · ')}`)
    const liqPago = r2((depois.body?.data ?? []).reduce((a: number, x: any) => a + x.netValue, 0))
    const splitPago = r2((depois.body?.data ?? []).reduce((a: number, x: any) => a + (x.split ?? []).reduce((b: number, s: any) => b + (s.totalValue ?? s.fixedValue ?? 0), 0), 0))
    achado(`Σ netValue pago=${liqPago}; Σ split=${splitPago}; sobra p/ raiz=${r2(liqPago - splitPago)} (esperado ${taxaAdm}); Δ saldo raiz agora=${r2((await saldo()) - raizAntes)} (cartão só credita em ~32 dias)`)
    estadoD03 = { inst, primeira: p.body.id }
    concluir(`link c/ split: ${link.ok ? (link.body?.split ? 'split aparece no link' : 'aceito mas SEM split na resposta') : 'recusado'}; parcelado: ${sp.ok ? 'split por PUT ok' : 'PUT split falhou'}`)
  },

  async d04() {
    etapa('d04')
    const customer = await cliente('clientePsi', false, 'Psicóloga Spike (assinante)')
    const s = await api('POST', '/subscriptions', {
      customer, billingType: 'CREDIT_CARD', value: 69.9, cycle: 'MONTHLY', nextDueDate: hoje(),
      description: 'Audere Essencial (spike)', externalReference: `spike-psi-${tag()}`,
    }, CHAVE_RAIZ, 'assinatura sem cartão')
    dado('assinatura', s.body)
    if (!s.ok) { concluir(`assinatura sem cartão recusada: ${JSON.stringify(s.body?.errors)}`); return }
    achado(`assinatura CREDIT_CARD sem cartão aceita: ${s.body.id} status=${s.body.status}`)
    estado.assinaturaApi = s.body.id; salvarEstado()
    const cobs = await api('GET', `/subscriptions/${s.body.id}/payments`)
    const primeira = cobs.body?.data?.[0]
    achado(`cobranças geradas: ${cobs.body?.data?.length}; 1ª ${primeira?.id} venc=${primeira?.dueDate} invoiceUrl=${primeira?.invoiceUrl}`)
    const pay = await cartaoPagar(primeira.id)
    achado(`pagar 1ª com cartão → ${pay.status} status=${pay.body?.status} creditCard=${JSON.stringify(redigir(pay.body?.creditCard))}`)
    await esperar(4000)
    const sDepois = await api('GET', `/subscriptions/${s.body.id}`)
    dado('assinaturaDepois', sDepois.body)
    achado(`assinatura depois: status=${sDepois.body?.status} nextDueDate=${sDepois.body?.nextDueDate} creditCard=${JSON.stringify(redigir(sDepois.body?.creditCard))}`)
    // Força a geração da próxima cobrança (vencimento amanhã) para ver se ela já nasce com o cartão
    const up = await api('PUT', `/subscriptions/${s.body.id}`, { nextDueDate: emDias(1), updatePendingPayments: true }, CHAVE_RAIZ, 'antecipar próxima')
    achado(`PUT nextDueDate=amanhã → ${up.status}`)
    await esperar(3000)
    const cobs2 = await api('GET', `/subscriptions/${s.body.id}/payments`)
    dado('cobrancasDepois', cobs2.body?.data)
    achado(`cobranças agora: ${cobs2.body?.data?.map((x: any) => `${x.dueDate}:${x.status}:${x.billingType}${x.creditCard ? ':cartão ' + x.creditCard.creditCardBrand : ''}`).join(' · ')}`)
    // 2ª assinatura deixada em aberto para pagar pela fatura (Chrome / manual)
    const s2 = await api('POST', '/subscriptions', {
      customer, billingType: 'CREDIT_CARD', value: 69.9, cycle: 'MONTHLY', nextDueDate: hoje(), description: 'Audere Essencial (spike fatura)',
    }, CHAVE_RAIZ, 'assinatura p/ pagar na fatura')
    const c2 = s2.ok ? (await api('GET', `/subscriptions/${s2.body.id}/payments`)).body?.data?.[0] : null
    dado('assinaturaFatura', { id: s2.body?.id, primeira: c2?.id, invoiceUrl: c2?.invoiceUrl })
    if (s2.ok) { estado.assinaturaFatura = s2.body.id; salvarEstado() }
    achado(`assinatura p/ teste pela fatura: ${s2.body?.id} → pagar em ${c2?.invoiceUrl}`)
    concluir(`assinatura sem cartão: ok; após 1º pagamento a assinatura guarda cartão? ${sDepois.body?.creditCard ? 'sim' : 'não visível'}`)
  },

  async estorno() {
    etapa('estorno')
    const sub = await precisaSubconta()
    // Logo após o recebimento o Asaas responde "tente novamente em alguns instantes":
    // repete a cada 30 s por até 5 min.
    const reembolsar = async (id: string, corpo: unknown, rotulo: string) => {
      for (let i = 0; ; i++) {
        const r = await api('POST', `/payments/${id}/refund`, corpo, CHAVE_RAIZ, rotulo)
        const desc = r.body?.errors?.[0]?.description ?? ''
        if (r.ok || !/Tente novamente/i.test(desc) || i >= 10) {
          if (i) achado(`${rotulo}: aceito depois de ${i} retentativa(s) (~${i * 30}s)`)
          return r
        }
        await esperar(30_000)
      }
    }
    const preparar = async (valor: number, rotulo: string) => {
      const r = await pagamentoPix(valor, undefined, rotulo)
      const { split } = splitAudere(valor, r.body.netValue, sub.walletId)
      await api('PUT', `/payments/${r.body.id}`, { split })
      await confirmarSandbox(r.body.id)
      await esperar(4000)
      return (await lerPagamento(r.body.id)).body
    }
    const fmtSplit = (p: any) => JSON.stringify(p?.split?.map((s: any) => ({ status: s.status, valor: s.totalValue, motivo: s.cancellationReason })))
    const refunds = async (id: string) => (await api('GET', `/payments/${id}/refunds`)).body?.data?.map((x: any) => ({ status: x.status, value: x.value, refundedSplits: x.refundedSplits }))

    // 1) parcial SEM splitRefunds: o rateio automático tira só da parte da raiz
    const q = await preparar(20, 'Estorno parcial sem splitRefunds')
    const rq = await reembolsar(q.id, { value: 5 }, 'parcial sem splitRefunds')
    achado(`parcial 5,00 sem splitRefunds → ${rq.status} ${rq.ok ? rq.body?.status : JSON.stringify(rq.body?.errors)}`)

    // 2) parcial COM splitRefunds
    const p = await preparar(20, 'Estorno parcial')
    const [raiz0, psi0] = [await saldo(), await saldo(sub.apiKey)]
    const rp = await reembolsar(p.id, { value: 5, description: 'parcial spike', splitRefunds: [{ id: p.split[0].id, value: 4 }] }, 'parcial c/ splitRefunds')
    achado(`parcial 5,00 c/ splitRefunds[{value:4}] → ${rp.status} ${rp.ok ? rp.body?.status : JSON.stringify(rp.body?.errors)}`)
    await esperar(3000)
    achado(`  Δ saldo raiz=${r2((await saldo()) - raiz0)} · Δ psicólogo=${r2((await saldo(sub.apiKey)) - psi0)} · refunds=${JSON.stringify(await refunds(p.id))} · split=${fmtSplit((await lerPagamento(p.id)).body)}`)

    // 3) total COM splitRefunds: precisa de saldo na raiz >= valor do estorno?
    const t = await preparar(10, 'Estorno total')
    const raizT = await saldo()
    const rt = await reembolsar(t.id, { value: 10, splitRefunds: [{ id: t.split[0].id, value: t.split[0].totalValue }] }, 'total c/ splitRefunds')
    achado(`total 10,00 c/ splitRefunds (saldo raiz antes=${raizT}) → ${rt.status} ${rt.ok ? rt.body?.status : JSON.stringify(rt.body?.errors)}`)
    await esperar(3000)
    const tDepois = (await lerPagamento(t.id)).body
    dado('total', { pagamento: tDepois, refunds: await refunds(t.id) })
    achado(`  depois: status=${tDepois?.status} split=${fmtSplit(tDepois)} refunds=${JSON.stringify(await refunds(t.id))}`)

    // 4) cartão parcelado (D-03), se houver
    if (estadoD03) {
      const rc = await api('POST', `/installments/${estadoD03.inst}/refund`, {}, CHAVE_RAIZ, 'estorno parcelamento')
      achado(`estorno do parcelamento cartão → ${rc.status} ${rc.ok ? '' : JSON.stringify(rc.body?.errors)}`)
      await esperar(3000)
      const l = await api('GET', `/payments?installment=${estadoD03.inst}`)
      achado(`  parcelas: ${l.body?.data?.map((x: any) => `${x.installmentNumber}:${x.status} split=${fmtSplit(x)}`).join(' · ')}`)
    }
    const ev = entregas.filter(e => /REFUND/.test(e.evento ?? '')).map(e => e.evento)
    achado(`webhooks de estorno recebidos: ${ev.join(', ') || 'nenhum ainda'}`)
    concluir('estornos executados — ver achados')
  },

  async webhook() {
    etapa('webhook')
    if (!ehUrlSpike()) { concluir('sem URL pública — não testado'); return }
    const r = await pagamentoPix(5, undefined, 'Webhook duplicado')
    forcarFalha.add(r.body.id)
    await confirmarSandbox(r.body.id)
    const primeira = await aguardarEvento(e => PAGO.has(e.evento) && e.recurso === r.body.id, 30_000)
    achado(primeira ? `1ª entrega ${primeira.evento} id=${primeira.idEvento} → respondemos 500 de propósito` : 'evento de pago não chegou em 30s')
    if (primeira) {
      console.log(`  aguardando reenvio por até ${ESPERA_REENVIO_S}s…`)
      const t0 = Date.now()
      let reenvio: Entrega | undefined
      while (!reenvio && Date.now() - t0 < ESPERA_REENVIO_S * 1000) {
        reenvio = entregas.find(e => e !== primeira && e.evento === primeira.evento && e.recurso === r.body.id)
        await esperar(2000)
      }
      achado(reenvio ? `reenvio após ${Math.round((Date.parse(reenvio.em) - Date.parse(primeira.em)) / 1000)}s com id ${reenvio.idEvento === primeira.idEvento ? 'IGUAL' : `DIFERENTE (${reenvio.idEvento})`}` : `sem reenvio em ${ESPERA_REENVIO_S}s`)
    }
    const amostra = entregas.find(e => PAGO.has(e.evento))
    dado('amostra', amostra?.corpo)
    achado(`formato do id: ${[...new Set(entregas.map(e => e.idEvento?.replace(/[0-9a-f-]{8,}/gi, '…')))].join(', ')}`)
    achado(`header asaas-access-token presente e igual ao authToken em ${entregas.filter(e => e.tokenConfere).length}/${entregas.length} entregas`)
    achado(`ordem dos eventos da cobrança: ${entregas.filter(e => e.recurso === r.body.id).map(e => `${e.evento}${e.respondido !== 200 ? '(500)' : ''}`).join(' → ')}`)
    const wh = await api('GET', `/webhooks/${webhookRaizId}`)
    achado(`webhook depois da falha: interrupted=${wh.body?.interrupted} penalizedRequestsCount=${wh.body?.penalizedRequestsCount}`)
    concluir('webhook testado')
  },
  /** Follow-up: o que depende de tempo ou de ação humana (fatura/link pagos pela página). */
  async pendencias() {
    etapa('pendencias')
    const cobs = async (sub: string) => (await api('GET', `/subscriptions/${sub}/payments`)).body?.data ?? []
    const fmt = (l: any[]) => l.map((x: any) => `${x.dueDate}:${x.status}${x.creditCard ? ':cartão ' + x.creditCard.creditCardBrand : ':sem cartão'}`).join(' · ')
    if (estado.assinaturaFatura) {
      const s = (await api('GET', `/subscriptions/${estado.assinaturaFatura}`)).body
      achado(`assinatura paga pela FATURA (${estado.assinaturaFatura}): creditCard=${JSON.stringify(redigir(s?.creditCard))} · cobranças: ${fmt(await cobs(estado.assinaturaFatura))}`)
    }
    if (estado.assinaturaApi) achado(`assinatura paga pela API (${estado.assinaturaApi}): cobranças: ${fmt(await cobs(estado.assinaturaApi))} (a de amanhã foi debitada sozinha?)`)
    if (estado.linkId) {
      // ?paymentLink= é ignorado pela API (devolve tudo): filtra pelo campo da cobrança
      const l = ((await api('GET', `/payments?paymentLink=${estado.linkId}&limit=100`)).body?.data ?? []).filter((x: any) => x.paymentLink === estado.linkId)
      achado(`cobranças do link ${estado.linkId}: ${l.length ? l.map((x: any) => `${x.id} ${x.status} ${x.installment ? 'parcelado' : 'à vista'} split=${JSON.stringify(x.split?.map((s: any) => [s.percentualValue ?? s.fixedValue, s.status]) ?? null)}`).join(' · ') : 'nenhuma (link ainda não pago)'}`)
    }
    concluir('pendências lidas')
  },
}
let estadoD03: { inst: string; primeira: string } | undefined

// ── Main ────────────────────────────────────────────────────────────────
/**
 * Encerra o túnel E os filhos. No Windows o ngrok sobe via `shell: true`:
 * `kill()` derrubava só o cmd.exe intermediário e o ngrok ficava órfão
 * (achado em 05/11/2026). `taskkill /T` leva a árvore inteira.
 */
function encerrarTunel() {
  if (!tunel?.pid) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(tunel.pid), '/T', '/F'], { stdio: 'ignore' })
  else tunel.kill()
}

async function main() {
  const args = process.argv.slice(2)
  const semWebhook = args.includes('--sem-webhook')
  const pedidas = args.filter(a => !a.startsWith('--'))
  const ordem = pedidas.length ? pedidas : Object.keys(ETAPAS).filter(e => e !== 'pendencias')
  for (const e of ordem) if (!ETAPAS[e]) { console.error(`etapa desconhecida: ${e}`); process.exit(1) }

  console.log(`Asaas sandbox · etapas: ${ordem.join(', ')}\nestado/log: ${DIR}`)
  if (!semWebhook && (await subirWebhook())) {
    const w = await criarWebhookRaiz()
    if (!w.ok) console.log(`  ! webhook raiz não criado: ${JSON.stringify(w.body?.errors)}`)
  }
  try {
    for (const e of ordem) {
      try { await ETAPAS[e]() } catch (err) {
        achado(`ERRO: ${(err as Error).message}`); atual.conclusao ||= 'interrompida por erro'
      }
    }
    if (ehUrlSpike()) await esperar(5000) // eventos atrasados
  } finally {
    await removerWebhookRaiz().catch(() => {})
    encerrarTunel()
    const saida = { em: new Date().toISOString(), base: BASE, resultados, entregas: entregas.map(e => ({ ...e })) }
    writeFileSync(ARQ_RESULT, JSON.stringify(saida, null, 2))
    writeFileSync(ARQ_LOG, JSON.stringify(log, null, 2))
    console.log(`\nResultado: ${ARQ_RESULT}\nLog HTTP:  ${ARQ_LOG}`)
    console.log('\n━━ Resumo ━━')
    for (const r of resultados) console.log(`• ${r.etapa}: ${r.conclusao}`)
    process.exit(0)
  }
}

main()
