import 'server-only'
/**
 * Documentos da subconta do psicólogo (KYC do Asaas). docs/asaas/sdd.md §4.1.
 *
 * Tudo com a apiKey DA SUBCONTA (`/myAccount/...` é sempre "a conta dona da
 * chave"). Cada grupo de documento diz como deve ser enviado:
 * - `onboardingUrl` preenchido → só pelo link externo do Asaas (identificação e
 *   selfie, com prova de vida). O POST recusa: "Esse tipo de documento não pode
 *   ser enviado via API". O link expira e é regerado quando um envio é
 *   reprovado — por isso a tela busca na hora do clique, nunca guarda.
 * - sem `onboardingUrl` → upload `multipart/form-data` (`documentFile` + `type`)
 *   em `POST /myAccount/documents/{idDoGrupo}`; um novo envio substitui o anterior.
 * No sandbox o link vem null (o suporte libera sob pedido).
 */
import { env } from '../../env'
import { log } from '../../log'
import { asaas, AsaasErro, errosDoCorpo } from './cliente'

export type StatusDocumento = 'NOT_SENT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'IGNORED'

export type GrupoDocumento = {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  status: StatusDocumento
  responsavel: string | null
  onboardingUrl: string | null
  /** Quantos arquivos já foram enviados neste grupo. */
  enviados: number
}

export type DocumentosSubconta = { motivoRecusa: string | null; grupos: GrupoDocumento[] }

export async function listarDocumentos(apiKey: string): Promise<DocumentosSubconta> {
  const r = await asaas<any>('GET', '/myAccount/documents', undefined, { chave: apiKey, rotulo: 'documentos da subconta' })
  const grupos: GrupoDocumento[] = (Array.isArray(r?.data) ? r.data : []).map((g: any) => ({
    id: String(g.id),
    tipo: String(g.type ?? 'CUSTOM'),
    titulo: String(g.title ?? 'Documento'),
    descricao: g.description ?? null,
    status: (g.status ?? 'NOT_SENT') as StatusDocumento,
    responsavel: g.responsible?.name ?? null,
    onboardingUrl: typeof g.onboardingUrl === 'string' && /^https:\/\//.test(g.onboardingUrl) ? g.onboardingUrl : null,
    enviados: Array.isArray(g.documents) ? g.documents.filter((d: any) => d?.status && d.status !== 'NOT_SENT').length : 0,
  }))
  return { motivoRecusa: typeof r?.rejectReasons === 'string' && r.rejectReasons.trim() ? r.rejectReasons.trim() : null, grupos }
}

/** Formatos que o Asaas aceita para upload; o teto é o limite da server action (4 MB). */
export const DOCUMENTO_TIPOS_ARQUIVO = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const DOCUMENTO_MAX_BYTES = 3.8 * 1024 * 1024

export async function enviarDocumento(apiKey: string, grupo: Pick<GrupoDocumento, 'id' | 'tipo'>, arquivo: File): Promise<void> {
  const fd = new FormData()
  fd.append('documentFile', arquivo, arquivo.name || 'documento')
  fd.append('type', grupo.tipo)
  const caminho = `/myAccount/documents/${encodeURIComponent(grupo.id)}`
  const t0 = Date.now()
  const r = await fetch(env.asaasUrl + caminho, {
    method: 'POST',
    // Sem Content-Type: o fetch monta o boundary do multipart.
    headers: { access_token: apiKey, 'User-Agent': 'Audere/1.0' },
    body: fd,
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
  })
  const texto = await r.text()
  let body: any = null
  try { body = texto ? JSON.parse(texto) : null } catch { body = texto }
  if (!r.ok) throw new AsaasErro(r.status, errosDoCorpo(body), '/myAccount/documents/{id}', body)
  log.ok('asaas.documentos', `documento ${grupo.tipo} enviado (${Date.now() - t0}ms)`)
}
