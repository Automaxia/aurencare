/**
 * Cria/atualiza o webhook da CONTA RAIZ do Asaas (cobranças e assinaturas).
 * O das subcontas vai no próprio POST /v3/accounts (recebedor.ts).
 *
 *   npm run asaas:webhook -- --url https://app.audere.ia.br/api/webhooks/asaas          # mostra o que faria
 *   npm run asaas:webhook -- --url https://app.audere.ia.br/api/webhooks/asaas --email ops@… --aplicar
 *
 * Usa ASAAS_API_URL/ASAAS_API_KEY/ASAAS_WEBHOOK_TOKEN do ambiente. Identifica o
 * nosso webhook pelo nome ("Audere — cobranças") e nunca toca nos outros
 * (o sandbox é compartilhado com o BolsoAI). Nunca imprime chave nem token.
 */
const NOME = 'Audere — cobranças'
const EVENTOS = [
  'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED',
  'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
  'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED',
]

async function main() {
  const args = process.argv.slice(2)
  const url = args[args.indexOf('--url') + 1]
  const aplicar = args.includes('--aplicar')
  // Obrigatório no Asaas: é para onde ele avisa se a fila for interrompida.
  const email = (args.includes('--email') ? args[args.indexOf('--email') + 1] : '') || process.env.ADMIN_ALERT_EMAIL
  const base = (process.env.ASAAS_API_URL || '').replace(/\/$/, '')
  const chave = process.env.ASAAS_API_KEY?.replace(/^\\\$/, '$') // aceita "\$aact_" (escape p/ o Next)
  const token = process.env.ASAAS_WEBHOOK_TOKEN
  if (!base || !chave) { console.error('ASAAS_API_URL/ASAAS_API_KEY ausentes.'); process.exit(1) }
  if (!url || !url.startsWith('https://') || args.indexOf('--url') < 0) { console.error('Informe --url https://…/api/webhooks/asaas'); process.exit(1) }
  if (!email) { console.error('Informe --email <contato> (ou ADMIN_ALERT_EMAIL): o Asaas avisa por ele se a fila travar.'); process.exit(1) }
  if (!token || token.length < 32 || token.length > 255) { console.error('ASAAS_WEBHOOK_TOKEN ausente ou fora de 32–255 caracteres.'); process.exit(1) }

  const api = async (metodo: string, caminho: string, corpo?: unknown) => {
    const r = await fetch(base + caminho, {
      method: metodo, body: corpo ? JSON.stringify(corpo) : undefined,
      headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'Audere/1.0' },
    })
    const j = await r.json().catch(() => null)
    if (!r.ok) throw new Error(`${metodo} ${caminho} → ${r.status} ${JSON.stringify(j?.errors ?? j)}`)
    return j
  }

  console.log(`Asaas ${base.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO'} · webhook "${NOME}" → ${url}`)
  const lista = await api('GET', '/webhooks?limit=100')
  for (const w of lista.data ?? []) console.log(`  existente: ${w.name} · ${w.enabled ? 'ativo' : 'inativo'}${w.interrupted ? ' · INTERROMPIDO' : ''}`)
  const nosso = (lista.data ?? []).find((w: any) => w.name === NOME)
  const corpo = {
    name: NOME, url, email,
    enabled: true, interrupted: false, apiVersion: 3, sendType: 'SEQUENTIALLY',
    authToken: token, events: EVENTOS,
  }
  if (!aplicar) {
    console.log(`\n(simulação) ${nosso ? `atualizaria ${nosso.id}` : 'criaria um novo'} com ${EVENTOS.length} eventos. Use --aplicar.`)
    return
  }
  const r = nosso ? await api('PUT', `/webhooks/${nosso.id}`, corpo) : await api('POST', '/webhooks', corpo)
  console.log(`\n✓ ${nosso ? 'atualizado' : 'criado'}: ${r.id} · enabled=${r.enabled} · hasAuthToken=${r.hasAuthToken}`)
}

main().catch(err => { console.error((err as Error).message); process.exit(1) })
