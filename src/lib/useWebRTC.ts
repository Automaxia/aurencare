'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook de chamada WebRTC P2P 1:1 com signaling via SSE+POST.
 * O lado `caller` cria a offer assim que o outro lado entra (recebe 'hello').
 *
 * ICE servers vêm de `/api/ice` (STUN sempre; TURN quando configurado no cluster),
 * com fallback pra STUN-only caso a rota falhe. Ver `src/server/lib/turn.ts`.
 */

const STUN_FALLBACK: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

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
}

export function useWebRTC({ token, role, caller, withVideo = true }: Options): WebRTCState {
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

  // Constraints com AEC/NS/AGC + dispositivo escolhido (deviceId exact, se houver).
  function montarConstraints(cam: string | null, mic: string | null): MediaStreamConstraints {
    return {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(mic ? { deviceId: { exact: mic } } : {}) },
      video: withVideo ? { width: { ideal: 640 }, height: { ideal: 360 }, ...(cam ? { deviceId: { exact: cam } } : {}) } : false,
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
    let es: EventSource | null = null

    async function init() {
      try {
        // 1. Captura mic+cam locais. AEC/NS/AGC explícitos (senão o mic do paciente
        // capta a voz do psicólogo pelo alto-falante). RESILIENTE: se a câmera
        // falhar (ex.: câmera virtual morta), cai pra só-áudio em vez de derrubar
        // a chamada inteira — antes um getUserMedia que jogava deixava o psicólogo
        // sem entrar na sala (o paciente ficava sozinho).
        try {
          stream = await navigator.mediaDevices.getUserMedia(montarConstraints(null, null))
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

        // Adiciona tracks locais
        for (const t of stream.getTracks()) pc.addTrack(t, stream)

        // Recebe remote tracks.
        // Importante: emitimos uma NOVA referência de MediaStream a cada track
        // que chega. Sem isso, o áudio do paciente entrava no mesmo objeto e a
        // referência não mudava — então a transcrição do paciente (que faz
        // createMediaStreamSource e depende de [stream]) nunca religava quando o
        // áudio chegava depois do início da gravação. Resultado: só o psicólogo
        // era transcrito.
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

        // ICE → manda pelo signaling
        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            sendSignal({ type: 'candidate', candidate: ev.candidate.toJSON() })
          }
        }

        pc.onconnectionstatechange = () => {
          if (!pc) return
          const s = pc.connectionState
          if (s === 'connected') setEstado('conectado')
          else if (s === 'disconnected' || s === 'failed') setEstado('erro')
          else if (s === 'closed') setEstado('encerrado')
        }

        // 3. SSE de signaling
        es = new EventSource(`/api/sala/${token}/eventos?role=${role}`)
        esRef.current = es
        setEstado('aguardando_peer')

        es.onmessage = async (ev) => {
          try {
            const data = JSON.parse(ev.data)
            // Ignora as próprias mensagens (não devem chegar mas defensivo)
            if (data.from === role) return

            if (data.type === 'hello') {
              setOutroPresente(true)
              if (caller && pc) {
                setEstado('conectando')
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                sendSignal({ type: 'offer', sdp: offer.sdp ?? '' })
              }
            } else if (data.type === 'bye') {
              setOutroPresente(false)
              setOutroCompartilhando(false)
            } else if (data.type === 'screen') {
              setOutroCompartilhando(!!data.on)
            } else if (data.type === 'offer' && !caller && pc) {
              setEstado('conectando')
              await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
              remoteSetRef.current = true
              // drena ICE pendentes
              for (const c of pendingICE.current) {
                try { await pc.addIceCandidate(c) } catch { /* */ }
              }
              pendingICE.current = []
              const ans = await pc.createAnswer()
              await pc.setLocalDescription(ans)
              sendSignal({ type: 'answer', sdp: ans.sdp ?? '' })
            } else if (data.type === 'answer' && caller && pc) {
              await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
              remoteSetRef.current = true
              for (const c of pendingICE.current) {
                try { await pc.addIceCandidate(c) } catch { /* */ }
              }
              pendingICE.current = []
            } else if (data.type === 'candidate' && pc) {
              const cand = data.candidate as RTCIceCandidateInit
              if (remoteSetRef.current) {
                try { await pc.addIceCandidate(cand) } catch { /* */ }
              } else {
                pendingICE.current.push(cand)
              }
            }
          } catch (e) {
            console.warn('signaling msg erro', e)
          }
        }

        es.onerror = () => {
          // re-tenta automaticamente; só logamos
        }
      } catch (e: any) {
        setErr(e?.message ?? 'falha ao iniciar chamada')
        setEstado('erro')
      }
    }

    init()

    return () => {
      cancelled = true
      try { navigator.mediaDevices.removeEventListener?.('devicechange', listarDispositivos) } catch { /* */ }
      try { es?.close() } catch { /* */ }
      try { pc?.close() } catch { /* */ }
      ;(streamRef.current ?? stream)?.getTracks().forEach(t => t.stop())
      setEstado('encerrado')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, caller, withVideo])

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

  const trocarCamera = useCallback((deviceId: string) => { recapturar(deviceId, micId) }, [recapturar, micId])
  const trocarMicrofone = useCallback((deviceId: string) => { recapturar(camId, deviceId) }, [recapturar, camId])

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
    try { sendSignal({ type: 'bye' }) } catch { /* */ }
    try { esRef.current?.close() } catch { /* */ }
    try { pcRef.current?.close() } catch { /* */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    setEstado('encerrado')
  }, [sendSignal])

  return { estado, localStream, remoteStream, outroPresente, err, micOn, setMicOn, camOn, setCamOn, replaceVideoTrack, encerrar, cameras, microfones, camId, micId, trocarCamera, trocarMicrofone, semVideo, outroCompartilhando, sinalizarTela }
}
