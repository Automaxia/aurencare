'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook de chamada WebRTC P2P 1:1 com signaling via SSE+POST.
 * O lado `caller` cria a offer assim que o outro lado entra (recebe 'hello').
 *
 * ICE servers vêm de `/api/ice` (STUN sempre; TURN quando configurado no cluster),
 * com fallback pra STUN-only caso a rota falhe. Ver `src/server/lib/turn.ts`.
 *
 * RECONEXÃO: quando a conexão cai (ex.: o celular do paciente vai pro background e
 * volta) o P2P não retorna sozinho. A recuperação recria a assinatura SSE (que
 * refaz o handshake → o caller re-oferta com `iceRestart`) — mesma coisa que
 * fechar e reabrir a chamada, mas automática. Disparada por `visibilitychange`
 * (voltou pra frente) e por `connectionState` failed/disconnected.
 *
 * DISPOSITIVOS: a câmera/microfone escolhidos são lembrados no localStorage e
 * reusados como `deviceId: ideal` (cai no default do sistema se o lembrado sumir).
 */

const STUN_FALLBACK: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

const LS_CAM = 'audere.video.camId'
const LS_MIC = 'audere.video.micId'
function lerDispositivoSalvo(key: string): string | null {
  try { return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null } catch { return null }
}
function salvarDispositivo(key: string, id: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (id) window.localStorage.setItem(key, id)
    else window.localStorage.removeItem(key)
  } catch { /* localStorage indisponível — ignora */ }
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const r = await fetch('/api/ice', { cache: 'no-store' })
    if (!r.ok) return STUN_FALLBACK
    const data = await r.json()
    const list = data?.iceServers
    return Array.isArray(list) && list.length > 0 ? list : STUN_FALLBACK
  } catch {
    return STUN_FALLBACK
  }
}

type Role = 'psicologo' | 'paciente'
type Estado = 'inicializando' | 'aguardando_peer' | 'conectando' | 'conectado' | 'encerrado' | 'erro'

type Options = {
  token: string
  role: Role
  /** Se true, esse lado cria o `offer` quando vê o outro entrar. (use true no lado psicologo) */
  caller: boolean
  /** Solicitar vídeo + áudio. Default true. */
  withVideo?: boolean
  /** Recebe mensagens do canal app (palco compartilhado). Genérico e reusável. */
  onApp?: (payload: any) => void
}

export type WebRTCState = {
  estado: Estado
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  outroPresente: boolean
  err: string | null
  /** Toggle áudio local */
  micOn: boolean
  setMicOn: (on: boolean) => void
  /** Toggle vídeo local */
  camOn: boolean
  setCamOn: (on: boolean) => void
  /** Troca o track de vídeo ENVIADO (ex.: versão com blur). null = volta à câmera. Seamless, não renegocia. */
  replaceVideoTrack: (track: MediaStreamTrack | null) => void
  encerrar: () => void
  /** Câmeras/microfones disponíveis + o selecionado, pra UI de seleção de fonte. */
  cameras: MediaDeviceInfo[]
  microfones: MediaDeviceInfo[]
  camId: string | null
  micId: string | null
  trocarCamera: (deviceId: string) => void
  trocarMicrofone: (deviceId: string) => void
  /** true quando a chamada caiu pra só-áudio (câmera indisponível/recusada). */
  semVideo: boolean
  /** true quando o OUTRO peer está compartilhando a tela (vídeo remoto deve ser
   * exibido inteiro/contain, sem recorte). */
  outroCompartilhando: boolean
  /** Avisa o outro peer que começou/parou de compartilhar a tela. */
  sinalizarTela: (on: boolean) => void
  /** Envia uma mensagem pelo canal app (palco compartilhado) ao outro peer. */
  enviarApp: (payload: any) => void
}

export function useWebRTC({ token, role, caller, withVideo = true, onApp }: Options): WebRTCState {
  const [estado, setEstado] = useState<Estado>('inicializando')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [outroPresente, setOutroPresente] = useState(false)
  const [outroCompartilhando, setOutroCompartilhando] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [micOn, setMicOnState] = useState(true)
  const [camOn, setCamOnState] = useState(withVideo)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])
  const [camId, setCamId] = useState<string | null>(null)
  const [micId, setMicId] = useState<string | null>(null)
  const [semVideo, setSemVideo] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const pendingICE = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const micOnRef = useRef(true)
  const camOnRef = useRef(withVideo)

  // estado da reconexão
  const jaConectouRef = useRef(false)          // já esteve 'connected' ao menos uma vez
  const encerradoRef = useRef(false)           // hangup/unmount → não reconectar
  const estadoRef = useRef<Estado>('inicializando')
  estadoRef.current = estado
  const reconectarRef = useRef<() => void>(() => {})   // exposto pro handler de visibilidade
  const onAppRef = useRef(onApp)
  onAppRef.current = onApp

  // Constraints com AEC/NS/AGC + dispositivo escolhido. `modo`:
  //  - 'exact': falha se o dispositivo não existe (escolha explícita do usuário).
  //  - 'ideal': usa se existir, senão cai no default do sistema (init/lembrado).
  function montarConstraints(cam: string | null, mic: string | null, modo: 'ideal' | 'exact' = 'exact'): MediaStreamConstraints {
    const dev = (id: string) => (modo === 'exact' ? { deviceId: { exact: id } } : { deviceId: { ideal: id } })
    return {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(mic ? dev(mic) : {}) },
      video: withVideo ? { width: { ideal: 640 }, height: { ideal: 360 }, ...(cam ? dev(cam) : {}) } : false,
    }
  }

  async function listarDispositivos() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices()
      setCameras(devs.filter(d => d.kind === 'videoinput'))
      setMicrofones(devs.filter(d => d.kind === 'audioinput'))
    } catch { /* sem permissão pra rotular — ignora */ }
  }

  const sendSignal = useCallback(async (message: any) => {
    try {
      await fetch(`/api/sala/${token}/sinal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, message }),
      })
    } catch (e) {
      console.warn('signaling POST falhou', e)
    }
  }, [token, role])

  // Setup de PeerConnection + media + signaling
  useEffect(() => {
    let cancelled = false
    let pc: RTCPeerConnection | null = null
    let stream: MediaStream | null = null
    let reconexaoTimer: ReturnType<typeof setTimeout> | null = null
    let ultimaReconexao = 0

    const limparTimer = () => { if (reconexaoTimer) { clearTimeout(reconexaoTimer); reconexaoTimer = null } }

    // Recuperação: recria a assinatura SSE. O servidor refaz o handshake (envia
    // 'hello' pros dois lados) → o caller re-oferta com iceRestart. Fechar o ES
    // antigo primeiro evita assinatura duplicada. Debounce de 2s: se os dois lados
    // dispararem juntos (visibilidade + timer), evita re-ofertas duplicadas.
    function reconectar() {
      if (cancelled || encerradoRef.current) return
      const agora = Date.now()
      if (agora - ultimaReconexao < 2000) return
      ultimaReconexao = agora
      try { esRef.current?.close() } catch { /* */ }
      esRef.current = montarES()
    }
    reconectarRef.current = reconectar

    // Agenda uma reconexão se em `delay` a conexão ainda não voltou. 'disconnected'
    // costuma ser transitório (o ICE às vezes se recupera sozinho) → espera mais;
    // 'failed' é terminal → reage rápido.
    function agendarReconexao(delay: number) {
      limparTimer()
      reconexaoTimer = setTimeout(() => {
        if (cancelled || encerradoRef.current) return
        if (pcRef.current?.connectionState === 'connected') return
        reconectar()
      }, delay)
    }

    async function handleSignal(ev: MessageEvent) {
      const p = pcRef.current
      if (!p) return
      try {
        const data = JSON.parse(ev.data)
        if (data.from === role) return // ignora as próprias mensagens

        if (data.type === 'hello') {
          setOutroPresente(true)
          if (caller) {
            setEstado('conectando')
            // reconexão (já conectou antes) → iceRestart; primeira vez → offer normal
            const offer = await p.createOffer(jaConectouRef.current ? { iceRestart: true } : undefined)
            await p.setLocalDescription(offer)
            sendSignal({ type: 'offer', sdp: offer.sdp ?? '' })
          }
        } else if (data.type === 'bye') {
          setOutroPresente(false)
          setOutroCompartilhando(false)
        } else if (data.type === 'screen') {
          setOutroCompartilhando(!!data.on)
        } else if (data.type === 'app') {
          onAppRef.current?.(data.payload)
        } else if (data.type === 'offer' && !caller) {
          setEstado('conectando')
          await p.setRemoteDescription({ type: 'offer', sdp: data.sdp })
          remoteSetRef.current = true
          for (const c of pendingICE.current) { try { await p.addIceCandidate(c) } catch { /* */ } }
          pendingICE.current = []
          const ans = await p.createAnswer()
          await p.setLocalDescription(ans)
          sendSignal({ type: 'answer', sdp: ans.sdp ?? '' })
        } else if (data.type === 'answer' && caller) {
          await p.setRemoteDescription({ type: 'answer', sdp: data.sdp })
          remoteSetRef.current = true
          for (const c of pendingICE.current) { try { await p.addIceCandidate(c) } catch { /* */ } }
          pendingICE.current = []
        } else if (data.type === 'candidate') {
          const cand = data.candidate as RTCIceCandidateInit
          if (remoteSetRef.current) { try { await p.addIceCandidate(cand) } catch { /* */ } }
          else pendingICE.current.push(cand)
        }
      } catch (e) {
        console.warn('signaling msg erro', e)
      }
    }

    function montarES(): EventSource {
      const es = new EventSource(`/api/sala/${token}/eventos?role=${role}`)
      es.onmessage = handleSignal
      es.onerror = () => { /* EventSource re-tenta sozinho; só logaríamos */ }
      return es
    }

    async function init() {
      try {
        // 1. Captura mic+cam locais. AEC/NS/AGC explícitos (senão o mic do paciente
        // capta a voz do psicólogo pelo alto-falante). RESILIENTE: se a câmera
        // falhar, cai pra só-áudio em vez de derrubar a chamada. Usa a câmera/mic
        // LEMBRADOS (deviceId ideal) — se sumiram, cai no default do sistema.
        const camSalvo = lerDispositivoSalvo(LS_CAM)
        const micSalvo = lerDispositivoSalvo(LS_MIC)
        try {
          stream = await navigator.mediaDevices.getUserMedia(montarConstraints(camSalvo, micSalvo, 'ideal'))
        } catch (camErr) {
          if (!withVideo) throw camErr
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          })
          if (!cancelled) setSemVideo(true)
        }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setLocalStream(stream)
        setCamId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null)
        setMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? null)
        listarDispositivos()
        navigator.mediaDevices.addEventListener?.('devicechange', listarDispositivos)

        // 2. Cria peer connection (ICE servers do backend; STUN se falhar)
        const iceServers = await fetchIceServers()
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        pc = new RTCPeerConnection({ iceServers })
        pcRef.current = pc

        for (const t of stream.getTracks()) pc.addTrack(t, stream)

        // Recebe remote tracks. Emitimos uma NOVA referência de MediaStream a cada
        // track que chega — sem isso, a transcrição do paciente (createMediaStreamSource
        // que depende de [stream]) não religava quando o áudio chegava depois.
        const remote = new MediaStream()
        setRemoteStream(remote)
        pc.ontrack = (ev) => {
          const incoming = ev.streams[0]?.getTracks() ?? (ev.track ? [ev.track] : [])
          let changed = false
          for (const t of incoming) {
            if (!remote.getTracks().includes(t)) { remote.addTrack(t); changed = true }
          }
          if (changed) setRemoteStream(new MediaStream(remote.getTracks()))
        }

        pc.onicecandidate = (ev) => {
          if (ev.candidate) sendSignal({ type: 'candidate', candidate: ev.candidate.toJSON() })
        }

        pc.onconnectionstatechange = () => {
          const s = pcRef.current?.connectionState
          if (s === 'connected') { jaConectouRef.current = true; limparTimer(); setEstado('conectado') }
          else if (s === 'failed') { setEstado('conectando'); agendarReconexao(400) }
          else if (s === 'disconnected') { setEstado('conectando'); agendarReconexao(3500) }
          else if (s === 'closed') setEstado('encerrado')
        }
        // ICE 'failed' às vezes chega antes do connectionState — reforça a reação.
        pc.oniceconnectionstatechange = () => {
          if (pcRef.current?.iceConnectionState === 'failed') agendarReconexao(400)
        }

        // 3. SSE de signaling
        esRef.current = montarES()
        setEstado('aguardando_peer')
      } catch (e: any) {
        setErr(e?.message ?? 'falha ao iniciar chamada')
        setEstado('erro')
      }
    }

    init()

    return () => {
      cancelled = true
      encerradoRef.current = true
      limparTimer()
      try { navigator.mediaDevices.removeEventListener?.('devicechange', listarDispositivos) } catch { /* */ }
      try { esRef.current?.close() } catch { /* */ }
      try { pc?.close() } catch { /* */ }
      ;(streamRef.current ?? stream)?.getTracks().forEach(t => t.stop())
      setEstado('encerrado')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, caller, withVideo])

  // Reconexão ao voltar do background (o caso do celular): quando a aba volta a
  // ficar visível e a chamada JÁ tinha conectado mas não está mais 'conectado',
  // recria o signaling → renegocia. Cobre o SSE que ficou congelado no background.
  useEffect(() => {
    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      if (encerradoRef.current || !jaConectouRef.current) return
      if (estadoRef.current === 'conectado') return
      reconectarRef.current()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Troca a fonte (câmera/microfone) sem renegociar: re-captura com o deviceId
  // escolhido e faz replaceTrack no sender. Resolve o caso da "câmera virtual".
  const recapturar = useCallback(async (novoCam: string | null, novoMic: string | null) => {
    const pc = pcRef.current
    let novo: MediaStream
    try {
      novo = await navigator.mediaDevices.getUserMedia(montarConstraints(novoCam, novoMic))
    } catch {
      setErr('Não foi possível acessar a câmera/microfone selecionado.')
      return
    }
    setSemVideo(novo.getVideoTracks().length === 0)
    for (const t of novo.getTracks()) {
      t.enabled = t.kind === 'audio' ? micOnRef.current : camOnRef.current
      const sender = pc?.getSenders().find(s => s.track?.kind === t.kind)
      if (sender) { try { await sender.replaceTrack(t) } catch { /* */ } }
      else if (pc) { try { pc.addTrack(t, novo) } catch { /* */ } }
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = novo
    setLocalStream(novo)
    setCamId(novo.getVideoTracks()[0]?.getSettings().deviceId ?? novoCam ?? null)
    setMicId(novo.getAudioTracks()[0]?.getSettings().deviceId ?? novoMic ?? null)
    listarDispositivos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sinalizarTela = useCallback((on: boolean) => { sendSignal({ type: 'screen', on }) }, [sendSignal])
  const enviarApp = useCallback((payload: any) => { sendSignal({ type: 'app', payload }) }, [sendSignal])

  // Ao escolher explicitamente, LEMBRA a escolha (localStorage) pra próxima sessão.
  const trocarCamera = useCallback((deviceId: string) => { salvarDispositivo(LS_CAM, deviceId); recapturar(deviceId, micId) }, [recapturar, micId])
  const trocarMicrofone = useCallback((deviceId: string) => { salvarDispositivo(LS_MIC, deviceId); recapturar(camId, deviceId) }, [recapturar, camId])

  const setMicOn = useCallback((on: boolean) => {
    setMicOnState(on); micOnRef.current = on
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = on })
  }, [])

  const setCamOn = useCallback((on: boolean) => {
    setCamOnState(on); camOnRef.current = on
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = on })
  }, [])

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    const pc = pcRef.current
    if (!pc) return
    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
    const original = streamRef.current?.getVideoTracks()[0] ?? null
    sender?.replaceTrack(track ?? original).catch(() => { /* fail-safe: mantém o atual */ })
  }, [])

  const encerrar = useCallback(() => {
    encerradoRef.current = true
    try { sendSignal({ type: 'bye' }) } catch { /* */ }
    try { esRef.current?.close() } catch { /* */ }
    try { pcRef.current?.close() } catch { /* */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    setEstado('encerrado')
  }, [sendSignal])

  return { estado, localStream, remoteStream, outroPresente, err, micOn, setMicOn, camOn, setCamOn, replaceVideoTrack, encerrar, cameras, microfones, camId, micId, trocarCamera, trocarMicrofone, semVideo, outroCompartilhando, sinalizarTela, enviarApp }
}
