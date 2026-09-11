import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from '../env'
import { log } from '../log'
import { db } from '@/server/db/pool'
import { CATALOGO_META, CATEGORIA_TEMPLATES, IDIOMA_TEMPLATES, type TemplateMeta } from './templatesMeta'

/**
 * Cliente da WhatsApp Cloud API (Meta / Graph). Provider `meta` de `enviarWA`.
 *
 * Diferenças pro Evolution que este módulo absorve, pra que os chamadores não
 * precisem saber:
 *  - texto livre só dentro da janela de 24h (última mensagem DO PACIENTE);
 *    fora dela, template aprovado (`enviarMeta` decide);
 *  - o número é um `phone_number_id`, não uma instância com QR;
 *  - erros vêm em `error.code` (131047 = fora da janela, 131026 = número
 *    sem WhatsApp, 131030 = destinatário fora da lista de teste, 132001 =
 *    template inexistente/não aprovado).
 */

const JANELA_MS = 24 * 60 * 60 * 1000

function graph(path: string): string {
  return `https://graph.facebook.com/${env.metaGraphVersion}/${path}`
}
function headers() {
  return { Authorization: `Bearer ${env.metaToken}`, 'Content-Type': 'application/json' }
}

/** E.164 sem '+': é o que a Meta espera em `to`. Mesma regra do Evolution. */
export function paraNumeroMeta(telefone: string): string {
  const digits = telefone.replace(/\D/g, '')
  if (telefone.trim().startsWith('+')) return digits
  return digits.startsWith('55') ? digits : `55${digits}`
}

export type ResultadoEnvioMeta =
  | { ok: true; via: 'texto' | 'template'; id: string | null }
  | { ok: false; codigo: number | null; erro: string }

function erroGraph(err: any): { codigo: number | null; erro: string } {
  const e = err?.response?.data?.error
  if (e) {
    const detalhe = e.error_data?.details ? ` — ${e.error_data.details}` : ''
    return { codigo: typeof e.code === 'number' ? e.code : null, erro: `[${e.code ?? '?'}] ${e.message ?? 'erro'}${detalhe}` }
  }
  return { codigo: null, erro: err instanceof Error ? err.message : String(err) }
}

async function postMensagem(payload: Record<string, unknown>, via: 'texto' | 'template'): Promise<ResultadoEnvioMeta> {
  try {
    const { data } = await axios.post(
      graph(`${env.metaPhoneNumberId}/messages`),
      { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload },
      { headers: headers(), timeout: 12_000 },
    )
    return { ok: true, via, id: data?.messages?.[0]?.id ?? null }
  } catch (err) {
    return { ok: false, ...erroGraph(err) }
  }
}

export async function enviarTextoMeta(telefone: string, texto: string): Promise<ResultadoEnvioMeta> {
  return postMensagem({ to: paraNumeroMeta(telefone), type: 'text', text: { body: texto, preview_url: true } }, 'texto')
}

export async function enviarTemplateMeta(telefone: string, tpl: TemplateMeta): Promise<ResultadoEnvioMeta> {
  const components = tpl.params.length
    ? [{ type: 'body', parameters: tpl.params.map(p => ({ type: 'text', text: p })) }]
    : []
  return postMensagem({
    to: paraNumeroMeta(telefone),
    type: 'template',
    template: { name: tpl.name, language: { code: IDIOMA_TEMPLATES }, components },
  }, 'template')
}

/**
 * Janela de atendimento aberta? = o paciente escreveu nas últimas 24h.
 * Usa o próprio histórico do inbox (`wa_mensagens`, direcao='in'), que o
 * webhook alimenta antes de rotear a mensagem.
 */
export async function janelaAbertaMeta(telefone: string): Promise<boolean> {
  const { normalizar } = await import('@/server/services/wa-conversa')
  const { rows } = await db.query<{ ultima: string | null }>(
    `SELECT MAX(created_at) AS ultima FROM wa_mensagens WHERE telefone = $1 AND direcao = 'in'`,
    [normalizar(telefone)],
  )
  const ultima = rows[0]?.ultima ? new Date(rows[0].ultima).getTime() : 0
  return Date.now() - ultima < JANELA_MS
}

/**
 * Envio "inteligente": texto livre se a janela está aberta (mais rico e
 * grátis); template quando fechada. Se a janela parecia aberta mas a Meta
 * devolve 131047, tenta o template. Sem template e fora da janela, o erro
 * sobe claro — é a única situação sem saída, e o chamador precisa saber.
 */
export async function enviarMeta(telefone: string, texto: string, template?: TemplateMeta | null): Promise<ResultadoEnvioMeta> {
  if (template && !(await janelaAbertaMeta(telefone))) {
    return enviarTemplateMeta(telefone, template)
  }
  const r = await enviarTextoMeta(telefone, texto)
  if (!r.ok && r.codigo === 131047 && template) {
    log.warn('meta', `janela fechada pra ${telefone}; reenviando como template ${template.name}`)
    return enviarTemplateMeta(telefone, template)
  }
  if (!r.ok && r.codigo === 131047) {
    return { ok: false, codigo: r.codigo, erro: `${r.erro} — mensagem sem template e paciente sem escrever há +24h` }
  }
  return r
}

// ── Diagnóstico / administração ─────────────────────────────────────────

export type EstadoNumeroMeta = {
  configurado: boolean
  phoneNumberId: string | null
  telefone?: string | null
  nomeExibicao?: string | null
  statusNome?: string | null          // APPROVED | PENDING_REVIEW | DECLINED | …
  verificacao?: string | null         // VERIFIED | NOT_VERIFIED | EXPIRED
  qualidade?: string | null           // GREEN | YELLOW | RED | UNKNOWN
  limite?: string | null              // TIER_250 | TIER_2K | …
  erro?: string
}

export async function estadoNumeroMeta(): Promise<EstadoNumeroMeta> {
  const phoneNumberId = env.metaPhoneNumberId ?? null
  if (!integrationStatus.meta) return { configurado: false, phoneNumberId }
  try {
    const { data } = await axios.get(graph(`${phoneNumberId}`), {
      headers: headers(), timeout: 8_000,
      params: { fields: 'display_phone_number,verified_name,name_status,code_verification_status,quality_rating,messaging_limit_tier' },
    })
    return {
      configurado: true, phoneNumberId,
      telefone: data?.display_phone_number ?? null,
      nomeExibicao: data?.verified_name ?? null,
      statusNome: data?.name_status ?? null,
      verificacao: data?.code_verification_status ?? null,
      qualidade: data?.quality_rating ?? null,
      limite: data?.messaging_limit_tier ?? null,
    }
  } catch (err) {
    return { configurado: true, phoneNumberId, erro: erroGraph(err).erro }
  }
}

export type TemplateStatus = { name: string; status: string; category?: string; language?: string; rejected_reason?: string | null }

export async function listarTemplatesMeta(): Promise<{ ok: boolean; templates: TemplateStatus[]; erro?: string }> {
  if (!integrationStatus.meta || !env.metaWabaId) return { ok: false, templates: [], erro: 'META_WA_WABA_ID/META_WA_TOKEN ausentes' }
  try {
    const { data } = await axios.get(graph(`${env.metaWabaId}/message_templates`), {
      headers: headers(), timeout: 10_000,
      params: { fields: 'name,status,category,language,rejected_reason', limit: 200 },
    })
    const templates: TemplateStatus[] = (data?.data ?? []).map((t: any) => ({
      name: t.name, status: t.status, category: t.category, language: t.language, rejected_reason: t.rejected_reason ?? null,
    }))
    return { ok: true, templates }
  } catch (err) {
    return { ok: false, templates: [], erro: erroGraph(err).erro }
  }
}

/**
 * Cria na WABA os templates do catálogo que ainda não existem. Idempotente:
 * nunca edita nem apaga — template aprovado é imutável na Meta; pra mudar
 * texto, cria-se outro nome. Devolve o que criou e o que já estava lá.
 */
export async function sincronizarTemplatesMeta(): Promise<{ ok: boolean; criados: string[]; existentes: string[]; erros: { name: string; erro: string }[] }> {
  const lista = await listarTemplatesMeta()
  if (!lista.ok) return { ok: false, criados: [], existentes: [], erros: [{ name: '*', erro: lista.erro ?? 'falha ao listar' }] }

  const existentes = new Set(lista.templates.filter(t => t.language === IDIOMA_TEMPLATES).map(t => t.name))
  const criados: string[] = []
  const erros: { name: string; erro: string }[] = []

  for (const [name, def] of Object.entries(CATALOGO_META)) {
    if (existentes.has(name)) continue
    const components: any[] = [
      { type: 'BODY', text: def.body, example: { body_text: [def.exemplo] } },
    ]
    if (def.botoes?.length) {
      components.push({ type: 'BUTTONS', buttons: def.botoes.map(text => ({ type: 'QUICK_REPLY', text })) })
    }
    try {
      await axios.post(
        graph(`${env.metaWabaId}/message_templates`),
        { name, language: IDIOMA_TEMPLATES, category: CATEGORIA_TEMPLATES, components },
        { headers: headers(), timeout: 15_000 },
      )
      criados.push(name)
      log.ok('meta', `template criado: ${name}`)
    } catch (err) {
      const e = erroGraph(err).erro
      erros.push({ name, erro: e })
      log.err('meta', `falha ao criar template ${name}`, e)
    }
  }
  return { ok: erros.length === 0, criados, existentes: [...existentes].filter(n => n in CATALOGO_META), erros }
}

/** URL que o app Meta deve chamar (Configuração → Webhooks → WhatsApp). */
export function webhookUrlMeta(): string {
  return `${env.appUrl.replace(/\/$/, '')}/api/webhooks/meta`
}
