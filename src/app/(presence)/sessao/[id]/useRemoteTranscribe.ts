'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pluga um MediaStream (o áudio remoto do paciente vindo do WebRTC)
 * direto na AssemblyAI Universal-Streaming v3, via WebSocket no browser.
 *
 * Por que aqui (não no servidor):
 * - WebSpeech só captura microfone local, não MediaStream remoto.
 * - Roteando pelo backend, teríamos que abrir um proxy WS — overhead sem
 *   ganho, já que o token efêmero esconde a master key.
 *
 * Sessões longas (>10min):
 * - Token AssemblyAI expira em 600s. Aos 540s o hook abre uma SEGUNDA
 *   WS com token novo. Quando a nova abre, troca a referência ativa e
 *   manda Terminate pra antiga — gap audível ~0ms porque o
 *   processor.onaudioprocess passa a escrever na nova no mesmo tick.
 *
 * Migrar pra AudioWorklet quando AssemblyAI publicar processor oficial.
 */

type Options = {
  stream: MediaStream | null
  enabled: boolean
  onFinal: (texto: string, ts: string) => void
  onInterim?: (texto: string) => void
}

const WS_URL = 'wss://streaming.assemblyai.com/v3/ws'
const SAMPLE_RATE = 16_000
const FRAME_SIZE = 4096
const REFRESH_BEFORE_EXPIRY_MS = 60_000   // renova 60s antes do token expirar

export function useRemoteTranscribe({ stream, enabled, onFinal, onInterim }: Options) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFinalRef = useRef(onFinal)
  const onInterimRef = useRef(onInterim)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])

  useEffect(() => {
    if (!enabled || !stream || stream.getAudioTracks().length === 0) {
      setActive(false)
      return
    }

    let cancelled = false
    let ctx: AudioContext | null = null
    let processor: ScriptProcessorNode | null = null
    let source: MediaStreamAudioSourceNode | null = null
    /** WS que recebe frames AGORA. Trocada quando a nova abre. */
    let activeWs: WebSocket | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    async function fetchToken(): Promise<{ token: string; expiresIn: number } | null> {
      try {
        const r = await fetch('/api/transcribe/token', { cache: 'no-store' })
        const j = await r.json() as { token?: string; expiresIn?: number; demo?: boolean; error?: string }
        if (j.demo) {
          if (!cancelled) setError('AssemblyAI não configurado — transcrição do paciente desabilitada')
          return null
        }
        if (!j.token || !j.expiresIn) {
          if (!cancelled) setError(j.error ?? 'token indisponível')
          return null
        }
        return { token: j.token, expiresIn: j.expiresIn }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'falha ao obter token')
        return null
      }
    }

    /** Abre uma nova WS pareada a um token. Resolve quando onopen disparar. */
    function openWs(token: string, sampleRate: number): Promise<WebSocket> {
      return new Promise((resolve, reject) => {
        const url = `${WS_URL}?sample_rate=${sampleRate}&format_turns=true&token=${encodeURIComponent(token)}`
        const ws = new WebSocket(url)
        ws.binaryType = 'arraybuffer'
        ws.onopen = () => resolve(ws)
        ws.onerror = () => reject(new Error('falha na conexão com AssemblyAI'))
        ws.onclose = () => { /* ignora aqui — handler real é setado em attach */ }
      })
    }

    /** Liga handlers de mensagem/close à WS já aberta. */
    function attach(ws: WebSocket) {
      ws.onmessage = ev => {
        if (cancelled || ws !== activeWs) return   // ignora mensagens da WS antiga durante refresh
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg.type === 'Turn') {
            const texto: string = msg.transcript ?? ''
            if (!texto.trim()) return
            if (msg.end_of_turn) {
              onFinalRef.current(texto.trim(), new Date().toISOString())
              onInterimRef.current?.('')
            } else {
              onInterimRef.current?.(texto)
            }
          }
        } catch { /* */ }
      }
      ws.onclose = () => {
        if (cancelled || ws !== activeWs) return
        setActive(false)
      }
      ws.onerror = () => {
        if (cancelled || ws !== activeWs) return
        setError('conexão de transcrição caiu')
      }
    }

    /** Agenda renovação do token antes da expiração. */
    function scheduleRefresh(expiresInSec: number, sampleRate: number) {
      const delay = Math.max(5_000, expiresInSec * 1000 - REFRESH_BEFORE_EXPIRY_MS)
      refreshTimer = setTimeout(async () => {
        if (cancelled) return
        const tok = await fetchToken()
        if (!tok || cancelled) return
        let newWs: WebSocket
        try { newWs = await openWs(tok.token, sampleRate) } catch { return }
        if (cancelled) { try { newWs.close() } catch { /* */ }; return }
        attach(newWs)
        const old = activeWs
        activeWs = newWs                            // a partir daqui, frames vão pra newWs
        try {
          if (old?.readyState === WebSocket.OPEN) old.send(JSON.stringify({ type: 'Terminate' }))
          old?.close()
        } catch { /* */ }
        scheduleRefresh(tok.expiresIn, sampleRate)
      }, delay)
    }

    async function setup() {
      const first = await fetchToken()
      if (cancelled || !first) return

      const Ctx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext)
      ctx = new Ctx({ sampleRate: SAMPLE_RATE } as AudioContextOptions)
      const realRate = ctx.sampleRate

      source = ctx.createMediaStreamSource(stream!)
      processor = ctx.createScriptProcessor(FRAME_SIZE, 1, 1)
      source.connect(processor)
      const muteGain = ctx.createGain()
      muteGain.gain.value = 0
      processor.connect(muteGain)
      muteGain.connect(ctx.destination)

      let firstWs: WebSocket
      try { firstWs = await openWs(first.token, realRate) } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'falha ao conectar')
        return
      }
      if (cancelled) { try { firstWs.close() } catch { /* */ }; return }

      activeWs = firstWs
      attach(firstWs)
      setActive(true)
      scheduleRefresh(first.expiresIn, realRate)

      processor.onaudioprocess = e => {
        const ws = activeWs
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        const input = e.inputBuffer.getChannelData(0)
        const pcm = floatToPcm16(input)
        try { ws.send(pcm.buffer) } catch { /* */ }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      try { processor?.disconnect(); source?.disconnect() } catch { /* */ }
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        try { activeWs.send(JSON.stringify({ type: 'Terminate' })) } catch { /* */ }
      }
      try { activeWs?.close() } catch { /* */ }
      try { ctx?.close() } catch { /* */ }
      setActive(false)
    }
  }, [enabled, stream])

  return { active, error }
}

function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}
