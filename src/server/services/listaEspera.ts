import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'
import { enviarEmail } from '@/server/lib/email'
import { env } from '@/server/lib/env'
import { tplListaEsperaConfirmacao, tplListaEsperaAviso } from '@/server/lib/emailTemplates'

/** Extrai o endereço de "Nome <email>" ou retorna a própria string. */
function soEndereco(from: string): string {
  return from.match(/<([^>]+)>/)?.[1] ?? from.trim()
}

export type EntrarListaInput = {
  nome: string
  email: string
  crp?: string | null
  mensagem?: string | null
  origem?: string | null
  ip?: string | null
  userAgent?: string | null
}

export type EntrarListaResult =
  | { ok: true }
  | { ok: false; campo?: 'nome' | 'email'; error: string }

export async function entrarListaEspera(input: EntrarListaInput): Promise<EntrarListaResult> {
  const nome = input.nome.trim()
  const email = input.email.toLowerCase().trim()
  const crp = input.crp?.trim() || null
  const mensagem = input.mensagem?.trim() || null

  if (nome.length < 3 || nome.split(/\s+/).length < 2) {
    return { ok: false, campo: 'nome', error: 'Informe seu nome completo.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, campo: 'email', error: 'Email inválido.' }
  }

  try {
    await db.query(
      `INSERT INTO lista_espera (nome, email, crp, mensagem, origem, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         crp = COALESCE(EXCLUDED.crp, lista_espera.crp),
         mensagem = COALESCE(EXCLUDED.mensagem, lista_espera.mensagem)`,
      [nome, email, crp, mensagem, input.origem ?? 'lancamento', input.ip ?? null, input.userAgent ?? null],
    )
    log.ok('lista-espera', `nova entrada: ${email}`)

    // Notificações (fire-and-forget — falha de email não derruba o cadastro).
    // 1) confirmação pro inscrito · 2) aviso pra equipe (contato@automaxia.com.br).
    const adminTo = soEndereco(env.emailFrom)
    void Promise.all([
      enviarEmail({ to: email, ...tplListaEsperaConfirmacao({ nome }) })
        .catch(err => log.err('lista-espera', 'falha email confirmacao', err)),
      enviarEmail({ to: adminTo, replyTo: email, ...tplListaEsperaAviso({ nome, email, crp, mensagem, origem: input.origem ?? 'lancamento' }) })
        .catch(err => log.err('lista-espera', 'falha email aviso', err)),
    ])

    return { ok: true }
  } catch (err) {
    log.err('lista-espera', 'falha ao inserir', err)
    return { ok: false, error: 'Não conseguimos te incluir agora. Tente em alguns minutos.' }
  }
}

export async function contarListaEspera(): Promise<number> {
  try {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM lista_espera`,
    )
    return rows[0]?.n ?? 0
  } catch {
    return 0
  }
}
