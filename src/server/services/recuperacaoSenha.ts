import 'server-only'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { db } from '@/server/db/pool'
import { enviarEmail } from '@/server/lib/email'
import { env } from '@/server/lib/env'
import { log } from '@/server/lib/log'

/**
 * Recuperação de senha. Token aleatório de 32 bytes; guardamos só o SHA-256.
 * Validade 1h, uso único. A solicitação SEMPRE responde "ok" — não revela se o
 * email existe (evita enumeração de contas).
 */

const TTL_MIN = 60

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

/** Pede reset: se o email existir, gera token e manda email. Resposta neutra. */
export async function solicitarResetSenha(emailRaw: string): Promise<{ ok: true }> {
  const email = emailRaw.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: true }

  const { rows } = await db.query<{ id: string; nome: string }>(
    'SELECT id, nome FROM psicologos WHERE email = $1 LIMIT 1',
    [email],
  )
  const psi = rows[0]
  if (!psi) {
    log.warn('reset-senha', `pedido para email sem conta: ${email} (resposta neutra)`)
    return { ok: true }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256(token)

  // Invalida tokens anteriores ainda válidos dessa conta (1 link ativo por vez).
  await db.query(
    `UPDATE password_resets SET usado_em = NOW()
       WHERE psicologo_id = $1 AND usado_em IS NULL`,
    [psi.id],
  )
  await db.query(
    `INSERT INTO password_resets (psicologo_id, token_hash, expira_em)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [psi.id, tokenHash, String(TTL_MIN)],
  )

  const link = `${env.appUrl.replace(/\/$/, '')}/redefinir-senha/${token}`
  const primeiroNome = psi.nome.split(/\s+/)[0]

  await enviarEmail({
    to: email,
    subject: 'Redefinir sua senha · Audere',
    text:
      `Olá, ${primeiroNome}.\n\n` +
      `Recebemos um pedido para redefinir a senha da sua conta Audere.\n` +
      `Use o link abaixo (válido por 1 hora):\n\n${link}\n\n` +
      `Se não foi você, pode ignorar este email — sua senha continua a mesma.`,
    html: emailHtml(primeiroNome, link),
  })

  log.ok('reset-senha', `link enviado para ${email}`)
  return { ok: true }
}

export type RedefinirResult =
  | { ok: true; email: string }
  | { ok: false; error: string }

/** Valida o token e troca a senha. */
export async function redefinirSenha(token: string, novaSenha: string): Promise<RedefinirResult> {
  if (!token || token.length < 32) return { ok: false, error: 'Link inválido.' }
  if (novaSenha.length < 8) return { ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' }

  const tokenHash = sha256(token)
  const { rows } = await db.query<{ id: string; psicologo_id: string; email: string }>(
    `SELECT pr.id, pr.psicologo_id, p.email
       FROM password_resets pr
       JOIN psicologos p ON p.id = pr.psicologo_id
      WHERE pr.token_hash = $1 AND pr.usado_em IS NULL AND pr.expira_em > NOW()
      LIMIT 1`,
    [tokenHash],
  )
  const reg = rows[0]
  if (!reg) return { ok: false, error: 'Este link expirou ou já foi usado. Peça um novo.' }

  const senha_hash = await bcrypt.hash(novaSenha, 10)
  await db.query('UPDATE psicologos SET senha_hash = $1 WHERE id = $2', [senha_hash, reg.psicologo_id])
  await db.query('UPDATE password_resets SET usado_em = NOW() WHERE id = $1', [reg.id])

  log.ok('reset-senha', `senha redefinida para ${reg.email}`)
  return { ok: true, email: reg.email }
}

/** Checa se um token ainda é utilizável (pra página decidir o que mostrar). */
export async function tokenResetValido(token: string): Promise<boolean> {
  if (!token || token.length < 32) return false
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT TRUE AS ok FROM password_resets
      WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW() LIMIT 1`,
    [sha256(token)],
  )
  return !!rows[0]
}

function emailHtml(nome: string, link: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1825">
    <h2 style="font-weight:500;color:#291860">Redefinir sua senha</h2>
    <p>Olá, ${nome}.</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta <strong>Audere</strong>.
       O link abaixo é válido por <strong>1 hora</strong>:</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#6a4ec8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block;font-weight:500">
        Criar nova senha
      </a>
    </p>
    <p style="font-size:13px;color:#7a7590">Se não foi você, pode ignorar este email — sua senha continua a mesma.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="font-size:11px;color:#b0acc4">Audere · Sistema Operacional da Prática Clínica</p>
  </div>`
}
