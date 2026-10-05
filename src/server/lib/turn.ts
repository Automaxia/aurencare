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
 *   TURN_TTL                validade das credenciais efêmeras em s (default 86400, mínimo 6h)
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

/**
 * Lista de ICE servers para esta requisição. STUN sempre; TURN quando configurado.
 * Gera credenciais novas a cada chamada (no modo efêmero).
 */
export function getIceServers(): RTCIceServer[] {
  const urls = turnUrls()
  if (urls.length === 0) return [STUN]

  const secret = process.env.TURN_STATIC_AUTH_SECRET
  if (isConfigured(secret)) {
    // A credencial precisa valer a chamada INTEIRA: o coturn revalida o usuário
    // (= timestamp de expiração) a cada Refresh da alocação, a cada poucos minutos.
    // Com 1h, a chamada que passava pelo relay caía perto dos 60 min contados da
    // entrada na sala (o psicólogo abre antes, a sessão estica), e a reconexão
    // também falhava porque reaproveitava a mesma credencial vencida.
    // Piso de 6h; o padrão é 24h, o usual pra credencial REST do coturn.
    const ttl = Math.max(Number(process.env.TURN_TTL) || 86_400, 6 * 3600)
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
