import 'server-only'
import { createHmac } from 'node:crypto'
import { isConfigured } from './env'

/**
 * Monta a lista de ICE servers (STUN + TURN) entregue ao browser.
 *
 * STUN do Google é sempre incluído (gratuito, resolve a maioria dos NATs).
 * TURN só entra quando configurado — é o que faz a chamada sobreviver atrás de
 * NAT simétrico / 4G corporativo, onde o P2P direto falha.
 *
 * Dois modos de TURN, detectados automaticamente:
 *
 *  1. Efêmero (coturn `use-auth-secret`/`static-auth-secret`) — PREFERIDO.
 *     O servidor gera usuário=`<expiry>` e senha=`base64(HMAC-SHA1(secret, usuário))`.
 *     Como o paciente é anônimo e o bundle é público, NUNCA expomos uma senha
 *     fixa: cada cliente recebe credenciais que expiram em `TURN_TTL` segundos.
 *
 *  2. Estático (`TURN_USERNAME`/`TURN_PASSWORD`) — para serviços gerenciados
 *     (Twilio, Metered, etc.) que entregam credenciais fixas.
 *
 * Env:
 *   TURN_URLS               turn:host:3478?transport=udp,turns:host:5349  (csv)
 *   TURN_STATIC_AUTH_SECRET segredo compartilhado com o coturn (modo efêmero)
 *   TURN_USERNAME           usuário fixo (modo estático)
 *   TURN_PASSWORD           senha fixa (modo estático)
 *   TURN_TTL                validade das credenciais efêmeras em s (default 3600)
 */

const STUN: RTCIceServer = {
  urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
}

function turnUrls(): string[] {
  return (process.env.TURN_URLS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)
}

/** Credenciais efêmeras no formato REST do coturn (RFC draft turn-rest). */
function efemeras(secret: string, ttlSec: number): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSec
  const username = String(expiry)
  const credential = createHmac('sha1', secret).update(username).digest('base64')
  return { username, credential }
}

export function turnConfigured(): boolean {
  const urls = turnUrls()
  if (urls.length === 0) return false
  return (
    isConfigured(process.env.TURN_STATIC_AUTH_SECRET) ||
    (isConfigured(process.env.TURN_USERNAME) && isConfigured(process.env.TURN_PASSWORD))
  )
}

/**
 * Lista de ICE servers para esta requisição. STUN sempre; TURN quando configurado.
 * Gera credenciais novas a cada chamada (no modo efêmero).
 */
export function getIceServers(): RTCIceServer[] {
  const urls = turnUrls()
  if (urls.length === 0) return [STUN]

  const secret = process.env.TURN_STATIC_AUTH_SECRET
  if (isConfigured(secret)) {
    const ttl = Number(process.env.TURN_TTL) || 3600
    const { username, credential } = efemeras(secret!, ttl)
    return [STUN, { urls, username, credential }]
  }

  const username = process.env.TURN_USERNAME
  const credential = process.env.TURN_PASSWORD
  if (isConfigured(username) && isConfigured(credential)) {
    return [STUN, { urls, username, credential }]
  }

  // URLs presentes mas sem credencial válida → degrada pra STUN-only.
  return [STUN]
}
