import 'server-only'
import bcrypt from 'bcrypt'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

export type NovaPsicologa = {
  nome: string
  crp: string
  email: string
  telefone: string  // E164 sem '+' ou só DDD+número (vamos normalizar)
  senha: string
}

export type CadastroResult =
  | { ok: true; id: string; email: string }
  | { ok: false; error: string; campo?: keyof NovaPsicologa }

/**
 * Cria conta nova de psicóloga. Sem campos técnicos — tudo o que precisa
 * de provisionamento (instância WhatsApp, recipient Pagar.me) é gerado
 * automaticamente em background. Ela só preenche o básico.
 */
export async function cadastrarPsicologa(input: NovaPsicologa): Promise<CadastroResult> {
  const nome = input.nome.trim()
  const crp = input.crp.trim()
  const email = input.email.toLowerCase().trim()
  const telefone = input.telefone.replace(/\D/g, '')

  // Validações
  if (nome.length < 3 || nome.split(/\s+/).length < 2)
    return { ok: false, error: 'Informe seu nome completo (mínimo nome e sobrenome).', campo: 'nome' }
  if (crp.length < 3)
    return { ok: false, error: 'Informe seu CRP (ex: CRP 06/12345).', campo: 'crp' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: 'Email inválido.', campo: 'email' }
  if (telefone.length < 10 || telefone.length > 13)
    return { ok: false, error: 'Telefone inválido (DDD + número).', campo: 'telefone' }
  if (input.senha.length < 8)
    return { ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.', campo: 'senha' }

  // Conflito de email ou CRP?
  const { rows: dup } = await db.query<{ campo: string }>(
    `SELECT 'email' AS campo FROM psicologos WHERE email = $1
      UNION
     SELECT 'crp'   AS campo FROM psicologos WHERE crp   = $2
      LIMIT 1`,
    [email, crp],
  )
  if (dup[0]?.campo === 'email') return { ok: false, error: 'Este email já tem cadastro.', campo: 'email' }
  if (dup[0]?.campo === 'crp')   return { ok: false, error: 'Este CRP já tem cadastro.', campo: 'crp' }

  // Bastidores: gera slug pra instância WhatsApp (será usada se/quando provisionar Evolution)
  const waInstancia = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'psicologa'

  const senha_hash = await bcrypt.hash(input.senha, 10)

  try {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO psicologos
         (nome, crp, email, senha_hash, telefone, wa_instancia, valor_sessao, termos_aceitos_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [nome, crp, email, senha_hash, telefone, waInstancia, 200],
    )
    log.ok('cadastro', `nova psicóloga: ${email} (instância wa=${waInstancia})`)
    return { ok: true, id: rows[0].id, email }
  } catch (err: any) {
    if (err?.code === '23505') {
      return { ok: false, error: 'Email ou CRP já em uso.' }
    }
    log.err('cadastro', 'falha ao criar psicóloga', err)
    return { ok: false, error: 'Não foi possível criar a conta agora.' }
  }
}
