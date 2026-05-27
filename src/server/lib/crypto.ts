import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

/**
 * AES-256-GCM com chave derivada de ENCRYPTION_KEY (hex). §14.
 * Formato armazenado: `v1:<iv-base64>:<ciphertext-base64>:<authTag-base64>`.
 */

const ALG = 'aes-256-gcm'

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY ausente')
  // aceita hex de 32 bytes (64 chars) OU string arbitrária (faz hash SHA-256)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return createHash('sha256').update(raw).digest()
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${enc.toString('base64')}:${tag.toString('base64')}`
}

export function decrypt(payload: string): string {
  const [version, ivB64, encB64, tagB64] = payload.split(':')
  if (version !== 'v1') throw new Error('formato cripto desconhecido')
  const iv = Buffer.from(ivB64, 'base64')
  const enc = Buffer.from(encB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = createDecipheriv(ALG, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export function tryDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null
  try { return decrypt(payload) } catch { return payload }
}
