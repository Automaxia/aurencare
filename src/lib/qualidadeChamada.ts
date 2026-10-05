'use client'

/**
 * Mede a qualidade da chamada no navegador (getStats a cada 5 s) e manda um
 * resumo pra /api/sala/[token]/qualidade a cada minuto e ao sair da página.
 * Nada de conteúdo da chamada — só caminho de rede, latência, perda, quadros.
 *
 * Perguntas que o resumo responde:
 *  - a chamada foi direta (P2P) ou pelo relay (TURN)? Qual servidor/protocolo?
 *  - latência (RTT), perda de pacotes, jitter, congelamentos do vídeo recebido;
 *  - o codec rodou em hardware (powerEfficient*) — o caso do celular esquentando;
 *  - o envio foi limitado por CPU ou banda (qualityLimitationDurations).
 */

const AMOSTRA_MS = 5_000
const ENVIO_MS = 60_000

type Caminho = 'direto' | 'stun' | 'relay' | 'desconhecido'

function tipoCaminho(local?: string, remoto?: string): Caminho {
  if (!local || !remoto) return 'desconhecido'
  if (local === 'relay' || remoto === 'relay') return 'relay'
  if (local === 'host' && remoto === 'host') return 'direto'
  return 'stun'
}

function navegadorCurto(): string {
  const ua = navigator.userAgent
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'outro'
  const nav = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'outro'
  return `${nav}/${so}`
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function iniciarQualidadeChamada(opts: {
  token: string
  role: 'psicologo' | 'paciente'
  getPc: () => RTCPeerConnection | null
}) {
  const conexaoId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 40)
  const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const navegador = navegadorCurto()
  const inicio = Date.now()

  // Agregados
  let amostras = 0, conectadoS = 0
  const caminhos: Record<Caminho, number> = { direto: 0, stun: 0, relay: 0, desconhecido: 0 }
  let rttSoma = 0, rttN = 0, rttMax = 0, rttAcima300 = 0
  let fpsSoma = 0, fpsN = 0
  let quedas = 0, reconexoes = 0
  // Últimas leituras (contadores cumulativos do getStats)
  let ultimo: Record<string, unknown> = {}

  async function amostrar() {
    const pc = opts.getPc()
    if (!pc) return
    amostras++
    if (pc.connectionState !== 'connected') return
    conectadoS += AMOSTRA_MS / 1000
    let stats: RTCStatsReport
    try { stats = await pc.getStats() } catch { return }

    const porId = new Map<string, any>()
    stats.forEach((s: any) => porId.set(s.id, s))
    let par: any = null
    stats.forEach((s: any) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) par = porId.get(s.selectedCandidatePairId) ?? par
    })
    if (!par) stats.forEach((s: any) => { if (s.type === 'candidate-pair' && (s.selected || (s.nominated && s.state === 'succeeded'))) par = s })

    const local = par ? porId.get(par.localCandidateId) : null
    const remoto = par ? porId.get(par.remoteCandidateId) : null
    const caminho = tipoCaminho(local?.candidateType, remoto?.candidateType)
    caminhos[caminho]++

    if (typeof par?.currentRoundTripTime === 'number') {
      const ms = par.currentRoundTripTime * 1000
      rttSoma += ms; rttN++; rttMax = Math.max(rttMax, ms)
      if (ms > 300) rttAcima300++
    }

    let videoIn: any = null, audioIn: any = null, videoOut: any = null
    stats.forEach((s: any) => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') videoIn = s
      if (s.type === 'inbound-rtp' && s.kind === 'audio') audioIn = s
      if (s.type === 'outbound-rtp' && s.kind === 'video' && !s.rid) videoOut = s
    })
    if (typeof videoIn?.framesPerSecond === 'number') { fpsSoma += videoIn.framesPerSecond; fpsN++ }

    const perda = (s: any) => {
      const lost = Math.max(0, s?.packetsLost ?? 0), rec = s?.packetsReceived ?? 0
      return lost + rec > 0 ? r1((lost / (lost + rec)) * 100) : null
    }
    const codec = (s: any) => (s?.codecId ? porId.get(s.codecId)?.mimeType : undefined)

    ultimo = {
      caminho,
      localTipo: local?.candidateType, remotoTipo: remoto?.candidateType,
      protocolo: local?.protocol, relayProtocolo: local?.relayProtocol,
      relayUrl: local?.candidateType === 'relay' ? String(local?.url ?? '').slice(0, 80) || undefined : undefined,
      bandaSaidaKbps: typeof par?.availableOutgoingBitrate === 'number' ? Math.round(par.availableOutgoingBitrate / 1000) : undefined,
      videoRecebido: videoIn ? {
        codec: codec(videoIn),
        largura: videoIn.frameWidth, altura: videoIn.frameHeight,
        perdaPct: perda(videoIn),
        congelamentos: videoIn.freezeCount, congeladoS: videoIn.totalFreezesDuration != null ? r1(videoIn.totalFreezesDuration) : undefined,
        decoder: videoIn.decoderImplementation, decoderHw: videoIn.powerEfficientDecoder,
      } : undefined,
      audioRecebido: audioIn ? {
        perdaPct: perda(audioIn),
        jitterMs: audioIn.jitter != null ? Math.round(audioIn.jitter * 1000) : undefined,
        // fração de áudio "inventado" pra cobrir pacote perdido (som picotado)
        ocultadoPct: audioIn.totalSamplesReceived ? r1((audioIn.concealedSamples / audioIn.totalSamplesReceived) * 100) : undefined,
      } : undefined,
      videoEnviado: videoOut ? {
        codec: codec(videoOut),
        largura: videoOut.frameWidth, altura: videoOut.frameHeight, fps: videoOut.framesPerSecond,
        encoder: videoOut.encoderImplementation, encoderHw: videoOut.powerEfficientEncoder,
        limitacao: videoOut.qualityLimitationReason,
        limitacaoS: videoOut.qualityLimitationDurations
          ? Object.fromEntries(Object.entries(videoOut.qualityLimitationDurations as Record<string, number>)
              .filter(([k, v]) => k !== 'none' && v > 0).map(([k, v]) => [k, Math.round(v)]))
          : undefined,
      } : undefined,
    }
  }

  function resumo() {
    return {
      duracaoS: Math.round((Date.now() - inicio) / 1000),
      conectadoS: Math.round(conectadoS),
      amostras,
      caminhos,
      rttMediaMs: rttN ? Math.round(rttSoma / rttN) : null,
      rttMaxMs: rttN ? Math.round(rttMax) : null,
      rttAcima300Pct: rttN ? Math.round((rttAcima300 / rttN) * 100) : null,
      fpsRecebidoMedia: fpsN ? r1(fpsSoma / fpsN) : null,
      quedas, reconexoes,
      ultimo,
    }
  }

  const url = `/api/sala/${opts.token}/qualidade`
  const corpo = () => JSON.stringify({ role: opts.role, conexaoId, mobile, navegador, resumo: resumo() })
  function enviar() {
    if (!amostras) return
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo(), keepalive: true }).catch(() => {})
  }
  function enviarSaindo() {
    if (!amostras) return
    try { navigator.sendBeacon?.(url, new Blob([corpo()], { type: 'application/json' })) || enviar() } catch { enviar() }
  }

  const tAmostra = setInterval(() => { amostrar().catch(() => {}) }, AMOSTRA_MS)
  const tEnvio = setInterval(enviar, ENVIO_MS)
  window.addEventListener('pagehide', enviarSaindo)

  return {
    /** connectionState foi pra disconnected/failed. */
    queda() { quedas++ },
    /** Disparou a recuperação (novo handshake + iceRestart). */
    reconexao() { reconexoes++ },
    parar() {
      clearInterval(tAmostra); clearInterval(tEnvio)
      window.removeEventListener('pagehide', enviarSaindo)
      enviarSaindo()
    },
  }
}
