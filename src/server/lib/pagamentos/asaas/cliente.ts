import 'server-only'
/**
 * Cliente HTTP do Asaas (API v3). docs/asaas/sdd.md §4.
 *
 * - Autenticação pelo header `access_token` (chave da raiz ou da subconta).
 * - Ambiente pela URL (`ASAAS_API_URL`), não pelo prefixo da chave.
 * - Timeout de 60 s: criar subconta levou 10–29 s no sandbox (spike §1).
 * - Sem retry automático em escrita (POST/PUT/DELETE): repetir pode duplicar
 *   cobrança/subconta. Só leituras (GET) repetem, com backoff, em 429/5xx.
 */
import { env } from '../../env'
import { log } from '../../log'

export type AsaasErroItem = { code: string; description: string }

export class AsaasErro extends Error {
  constructor(
    public readonly status: number,
    public readonly erros: AsaasErroItem[],
    public readonly caminho: string,
    public readonly corpo: unknown = null,
  ) {
    super(`asaas ${status} ${caminho}: ${erros.map(e => `${e.code}: ${e.description}`).join(' | ') || 'sem detalhe'}`)
    this.name = 'AsaasErro'
  }
  /** Primeira descrição — já vem em português. */
  get descricao(): string { return this.erros[0]?.description ?? this.message }
  tem(re: RegExp): boolean { return this.erros.some(e => re.test(e.description) || re.test(e.code)) }
}

type Opcoes = { chave?: string; timeoutMs?: number; rotulo?: string }

export function ambienteAsaas(): 'sandbox' | 'live' {
  return env.asaasUrl.includes('sandbox') ? 'sandbox' : 'live'
}

export async function asaas<T = any>(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown, op: Opcoes = {}): Promise<T> {
  const chave = op.chave ?? env.asaasKey
  if (!chave) throw new Error('asaas_sem_chave')
  const tentativas = metodo === 'GET' ? 3 : 1
  let ultimo: unknown
  for (let i = 0; i < tentativas; i++) {
    const t0 = Date.now()
    let r: Response
    try {
      r = await fetch(env.asaasUrl + caminho, {
        method: metodo,
        headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'Audere/1.0' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(op.timeoutMs ?? 60_000),
        cache: 'no-store',
      })
    } catch (err) {
      ultimo = err
      log.warn('asaas', `${metodo} ${caminho.split('?')[0]} falhou na rede (${Date.now() - t0}ms): ${(err as Error).message}`)
      if (i + 1 < tentativas) { await new Promise(res => setTimeout(res, 1000 * 2 ** i)); continue }
      throw err
    }
    const texto = await r.text()
    let body: any = null
    try { body = texto ? JSON.parse(texto) : null } catch { body = texto }
    if (r.ok) return body as T
    const erro = new AsaasErro(r.status, Array.isArray(body?.errors) ? body.errors : [], caminho.split('?')[0], body)
    // 429 = limite de requisições (25 mil / 12 h): nunca repetir na hora.
    if ((r.status === 429 || r.status >= 500) && i + 1 < tentativas) {
      ultimo = erro
      await new Promise(res => setTimeout(res, r.status === 429 ? 5000 * (i + 1) : 1000 * 2 ** i))
      continue
    }
    throw erro
  }
  throw ultimo
}
