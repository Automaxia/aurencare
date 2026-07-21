'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, Aperture, ScreenShare, ScreenShareOff, Settings, Target, PenLine, SmilePlus, Network } from 'lucide-react'
import { useWebRTC, type WebRTCState } from '@/lib/useWebRTC'
import { useBackgroundBlur } from '@/lib/useBackgroundBlur'
import { useFaceFraming } from '@/lib/useFaceFraming'
import { PalcoCompartilhado, type PalcoState } from './PalcoCompartilhado'
import { QuadroOverlay } from './QuadroOverlay'

type Props = {
  token: string
  role: 'psicologo' | 'paciente'
  caller: boolean
  /** Layout enxuto pra embutir no Modo Presença */
  compact?: boolean
  /** Tela cheia (sala do paciente) — sem cantos, sem minimizar/maximizar de janela */
  fill?: boolean
  /** Quando encerrar, callback (opcional) */
  onEncerrar?: () => void
  /** Notifica quando o stream remoto (do outro lado) muda. Usado pra plumbar
   * o áudio do paciente pra transcrição AssemblyAI no Modo Presença. */
  onRemoteStream?: (stream: MediaStream | null) => void
  /** Notifica quando minimiza/restaura — pra o container (MovableWindow) sumir
   * e não deixar uma caixa vazia no lugar. */
  onMinimizedChange?: (minimized: boolean) => void
  /** Lado do psicólogo: id do paciente, pra buscar o que compartilhar no palco.
   * Ausente = sem bandeja de compartilhamento (lado do paciente). */
  pacienteId?: string
  /** Lado do psicólogo: o paciente respondeu a checagem de humor (−5..+5). */
  onHumorPaciente?: (valor: number) => void
}

export function VideoCall({ token, role, caller, compact, fill, onEncerrar, onRemoteStream, onMinimizedChange, pacienteId, onHumorPaciente }: Props) {
  // Palco compartilhado — o psicólogo mostra um widget do site pro paciente.
  const [palco, setPalco] = useState<PalcoState>(null)
  const [quadroScene, setQuadroScene] = useState<any[] | null>(null)  // cena do quadro (viewer)
  const [humorResposta, setHumorResposta] = useState<number | null>(null) // resposta do humor
  const palcoRef = useRef<PalcoState>(null); palcoRef.current = palco
  const latestSceneRef = useRef<any[] | null>(null)                   // última cena enviada (editor), p/ re-sync
  const onHumorRef = useRef(onHumorPaciente); onHumorRef.current = onHumorPaciente
  const ctrl = useWebRTC({ token, role, caller, onApp: (p) => {
    if (!p) return
    if ('widget' in p) { setPalco(p.widget ? p : null); if (p.widget === 'humor') setHumorResposta(null) }
    if ('quadroScene' in p) setQuadroScene(p.quadroScene)     // atualização de cena do quadro
    if ('humorResposta' in p) { setHumorResposta(p.humorResposta); onHumorRef.current?.(p.humorResposta) } // paciente respondeu → psicólogo
  } })
  // Web-only: bandeja e palco só no desktop (widgets não cabem no mobile).
  const [desktop, setDesktop] = useState(false)
  useEffect(() => { setDesktop(window.matchMedia?.('(min-width: 1101px)').matches ?? false) }, [])
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const [showDev, setShowDev] = useState(false)

  // #10: janela do próprio vídeo arrastável (mouse + toque), presa dentro do quadro.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; bl: number; bt: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLVideoElement>) {
    const el = e.currentTarget
    const parent = el.parentElement
    if (!parent) return
    const r = el.getBoundingClientRect()
    const p = parent.getBoundingClientRect()
    dragRef.current = { sx: e.clientX, sy: e.clientY, bl: r.left - p.left, bt: r.top - p.top }
    try { el.setPointerCapture(e.pointerId) } catch { /* */ }
  }
  function onPointerMove(e: React.PointerEvent<HTMLVideoElement>) {
    const d = dragRef.current
    if (!d) return
    const el = e.currentTarget
    const p = el.parentElement!.getBoundingClientRect()
    const left = Math.max(6, Math.min(d.bl + (e.clientX - d.sx), p.width - el.offsetWidth - 6))
    const top = Math.max(6, Math.min(d.bt + (e.clientY - d.sy), p.height - el.offsetHeight - 6))
    setPos({ left, top })
  }
  function onPointerUp(e: React.PointerEvent<HTMLVideoElement>) {
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
  }

  // #1: controles da janela — maximizar (fullscreen), minimizar (flutuante), blur de fundo.
  const shellRef = useRef<HTMLDivElement>(null)
  const [minimized, setMinimized] = useState(false)
  const [maximized, setMaximized] = useState(false)
  // Orientação do vídeo remoto: paciente no celular manda retrato. Num container
  // paisagem, "cover" cortaria o rosto — então usamos "contain" pra mostrar o
  // quadro inteiro quando o vídeo é mais alto que largo.
  const [remotePortrait, setRemotePortrait] = useState(false)
  function aferirOrientacaoRemota(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (v.videoWidth && v.videoHeight) setRemotePortrait(v.videoHeight > v.videoWidth * 1.05)
  }
  const [blur, setBlur] = useState(false)
  const blurProc = useBackgroundBlur(ctrl.localStream, blur)
  const blurOk = !blurProc.error

  // Enquadramento facial do vídeo remoto quando há recorte forte (tela cheia /
  // sala do paciente em fullscreen): segue o rosto em vez de cortar no centro.
  // NÃO quando o outro está compartilhando a tela (aí mostramos a tela inteira).
  useFaceFraming(remoteRef, (maximized || !!fill) && !!ctrl.remoteStream && !ctrl.outroCompartilhando)

  // Compartilhamento de tela
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  async function toggleScreen() {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop())
      setScreenStream(null)
      return
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      s.getVideoTracks()[0]?.addEventListener('ended', () => setScreenStream(null)) // parou pela UI do navegador
      setBlur(false) // compartilhar tela desliga o desfoque
      setScreenStream(s)
    } catch { /* usuário cancelou */ }
  }

  // Avisa o outro peer que a tela está sendo compartilhada — pra ele exibir o
  // vídeo inteiro (contain) em vez de recortar. Cobre também o "parou pela UI".
  useEffect(() => { ctrl.sinalizarTela(!!screenStream) }, [screenStream, ctrl.sinalizarTela])

  useEffect(() => {
    const h = () => setMaximized(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // Ao maximizar/minimizar o quadro muda de tamanho — a posição arrastada (em px)
  // ficaria fora dos novos limites e o self-view "sumia". Reseta pra posição padrão.
  useEffect(() => { setPos(null) }, [minimized, maximized])

  // Avisa o container (MovableWindow) pra ele sumir quando minimizado.
  useEffect(() => { onMinimizedChange?.(minimized) }, [minimized, onMinimizedChange])

  // ── Palco compartilhado ────────────────────────────────────────────────
  const podePalco = role === 'psicologo' && desktop && !!pacienteId
  async function mostrarObjetivos() {
    if (!pacienteId) return
    const r = await fetch(`/api/pacientes/${pacienteId}/objetivos-palco`).then(res => res.json()).catch(() => null)
    const p: PalcoState = { widget: 'objetivos', data: { objetivos: r?.objetivos ?? [] } }
    setPalco(p); ctrl.enviarApp(p)
  }
  async function mostrarGrafo() {
    if (!pacienteId) return
    const grafo = await fetch(`/api/pacientes/${pacienteId}/temas`).then(res => res.json()).catch(() => null)
    const p: PalcoState = { widget: 'grafo', data: { grafo: grafo ?? { nodes: [], edges: [] } } }
    setPalco(p); ctrl.enviarApp(p)
  }
  function mostrarQuadro() {
    const p: PalcoState = { widget: 'quadro' }
    setPalco(p); ctrl.enviarApp({ widget: 'quadro' })
  }
  function enviarScene(elements: any[]) {
    latestSceneRef.current = elements
    ctrl.enviarApp({ quadroScene: elements })
  }
  function mostrarHumor() {
    const p: PalcoState = { widget: 'humor' }
    setPalco(p); setHumorResposta(null); ctrl.enviarApp({ widget: 'humor' })
  }
  function responderHumor(valor: number) {           // lado do paciente
    setHumorResposta(valor); ctrl.enviarApp({ humorResposta: valor })
  }
  function pararPalco() {
    setPalco(null); setQuadroScene(null); setHumorResposta(null); latestSceneRef.current = null
    ctrl.enviarApp({ widget: null })
  }

  // Re-sincroniza o palco quando o outro peer (re)entra — cobre a reconexão do
  // celular do paciente (o palco volta junto, sem o psicólogo reabrir nada).
  const outroPrev = useRef(false)
  useEffect(() => {
    if (ctrl.outroPresente && !outroPrev.current && role === 'psicologo' && palcoRef.current) {
      ctrl.enviarApp(palcoRef.current)
      if (palcoRef.current.widget === 'quadro' && latestSceneRef.current) {
        ctrl.enviarApp({ quadroScene: latestSceneRef.current })
      }
    }
    outroPrev.current = ctrl.outroPresente
  }, [ctrl.outroPresente, role, ctrl])

  async function toggleFullscreen() {
    const el = shellRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) { setMinimized(false); await el.requestFullscreen() }
      else await document.exitFullscreen()
    } catch { /* */ }
  }

  // Preview local: tela compartilhada > desfoque > câmera crua.
  useEffect(() => {
    const v = localRef.current
    if (!v) return
    v.srcObject = screenStream ? screenStream : (blur && blurProc.stream) ? blurProc.stream : ctrl.localStream
  }, [ctrl.localStream, blur, blurProc.stream, screenStream])

  // Track ENVIADO: tela compartilhada > blurred > câmera (null reverte pra câmera).
  useEffect(() => {
    if (screenStream) ctrl.replaceVideoTrack(screenStream.getVideoTracks()[0] ?? null)
    else if (blur && blurProc.stream) ctrl.replaceVideoTrack(blurProc.stream.getVideoTracks()[0] ?? null)
    else ctrl.replaceVideoTrack(null)
  }, [screenStream, blur, blurProc.stream, ctrl])

  // Falhou (modelo não carregou / device fraco) → volta o botão pro off.
  useEffect(() => { if (blurProc.error) setBlur(false) }, [blurProc.error])
  useEffect(() => {
    if (remoteRef.current && ctrl.remoteStream) remoteRef.current.srcObject = ctrl.remoteStream
    onRemoteStream?.(ctrl.remoteStream)
  }, [ctrl.remoteStream, onRemoteStream])

  return (
    <div
      ref={shellRef}
      className={`vc-shell${compact ? ' vc-compact' : ''}${fill ? ' vc-fill' : ''}${minimized ? ' vc-min' : ''}`}
      data-estado={ctrl.estado}
    >
      {/* Controles da janela — canto superior direito */}
      <div className="vc-winctrls">
        {(ctrl.cameras.length > 1 || ctrl.microfones.length > 1 || ctrl.semVideo) && (
          <div style={{ position: 'relative' }}>
            <button
              className={`vc-win${showDev ? ' on' : ''}`}
              onClick={() => setShowDev(s => !s)}
              title="Escolher câmera e microfone"
            >
              <Settings size={14} />
            </button>
            {showDev && (
              <>
                <div onClick={() => setShowDev(false)} style={{ position: 'fixed', inset: 0, zIndex: 7 }} />
                <div className="vc-devmenu">
                  <div className="vc-devmenu-row">
                    <label>Câmera</label>
                    <select value={ctrl.camId ?? ''} onChange={e => ctrl.trocarCamera(e.target.value)}>
                      {ctrl.semVideo && <option value="">Sem câmera</option>}
                      {ctrl.cameras.map((c, i) => (
                        <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Câmera ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="vc-devmenu-row">
                    <label>Microfone</label>
                    <select value={ctrl.micId ?? ''} onChange={e => ctrl.trocarMicrofone(e.target.value)}>
                      {ctrl.microfones.map((m, i) => (
                        <option key={m.deviceId || i} value={m.deviceId}>{m.label || `Microfone ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <button
          className={`vc-win${blur && blurProc.stream ? ' on' : ''}`}
          onClick={() => setBlur(b => !b)}
          disabled={!blurOk}
          title={!blurOk ? 'Desfoque indisponível neste dispositivo' : blur ? (blurProc.stream ? 'Desativar desfoque de fundo' : 'Carregando desfoque…') : 'Desfocar o fundo'}
        >
          <Aperture size={14} />
        </button>
        {!fill && (
          <button className="vc-win" onClick={() => setMinimized(m => !m)} title={minimized ? 'Restaurar' : 'Minimizar'}>
            <Minimize2 size={14} />
          </button>
        )}
        <button className="vc-win" onClick={toggleFullscreen} title={maximized ? 'Sair da tela cheia' : 'Maximizar'}>
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="vc-remote">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          onLoadedMetadata={aferirOrientacaoRemota}
          onResize={aferirOrientacaoRemota}
          style={{
            display: 'block', width: '100%', height: '100%', background: '#0e0c18',
            // Tela compartilhada ou vídeo retrato (celular) → mostra inteiro (contain),
            // pra não cortar o rosto. Câmera paisagem → preenche (cover).
            objectFit: ctrl.outroCompartilhando || remotePortrait ? 'contain' : 'cover',
          }}
        />
        {!ctrl.outroPresente && (
          <div className="vc-overlay">
            {ctrl.estado === 'aguardando_peer' && (role === 'psicologo'
              ? 'Aguardando paciente entrar…'
              : 'Aguardando psicóloga entrar…')}
            {ctrl.estado === 'inicializando' && 'Conectando câmera e microfone…'}
            {ctrl.estado === 'erro' && (ctrl.err ?? 'Falha ao conectar')}
            {ctrl.estado === 'encerrado' && 'Chamada encerrada'}
          </div>
        )}
        {ctrl.outroPresente && ctrl.estado === 'conectando' && (
          <div className="vc-overlay">Conectando…</div>
        )}
      </div>

      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        className="vc-local"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Arraste para reposicionar seu vídeo"
        style={{
          cursor: 'grab', touchAction: 'none',
          ...(pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : null),
        }}
      />

      {/* Palco compartilhado (web-only) — objetivos/grafo (read-only) e humor (interativo) */}
      {desktop && (palco?.widget === 'objetivos' || palco?.widget === 'grafo' || palco?.widget === 'humor') && (
        <PalcoCompartilhado
          palco={palco}
          role={role}
          humorResposta={humorResposta}
          onResponderHumor={responderHumor}
          onFechar={role === 'psicologo' ? pararPalco : undefined}
        />
      )}
      {/* Quadro branco — overlay fullscreen (via portal), editor no psicólogo */}
      {desktop && palco?.widget === 'quadro' && (
        <QuadroOverlay
          editor={role === 'psicologo'}
          scene={quadroScene}
          onScene={enviarScene}
          onFechar={role === 'psicologo' ? pararPalco : undefined}
        />
      )}

      {/* Bandeja de compartilhamento — só o psicólogo, no desktop */}
      {podePalco && (
        <div className="vc-tray">
          <button
            className={`vc-tray-btn${palco?.widget === 'objetivos' ? ' on' : ''}`}
            onClick={() => (palco?.widget === 'objetivos' ? pararPalco() : mostrarObjetivos())}
            title="Mostrar os objetivos do paciente na chamada"
          >
            <Target size={14} /> Objetivos
          </button>
          <button
            className={`vc-tray-btn${palco?.widget === 'grafo' ? ' on' : ''}`}
            onClick={() => (palco?.widget === 'grafo' ? pararPalco() : mostrarGrafo())}
            title="Mostrar o grafo de temas ao paciente"
          >
            <Network size={14} /> Grafo
          </button>
          <button
            className={`vc-tray-btn${palco?.widget === 'quadro' ? ' on' : ''}`}
            onClick={() => (palco?.widget === 'quadro' ? pararPalco() : mostrarQuadro())}
            title="Abrir o quadro branco com o paciente"
          >
            <PenLine size={14} /> Quadro
          </button>
          <button
            className={`vc-tray-btn${palco?.widget === 'humor' ? ' on' : ''}`}
            onClick={() => (palco?.widget === 'humor' ? pararPalco() : mostrarHumor())}
            title="Pedir a checagem de humor ao paciente"
          >
            <SmilePlus size={14} /> Humor
          </button>
        </div>
      )}

      <ControlsCall ctrl={ctrl} onEncerrar={onEncerrar} sharing={!!screenStream} onToggleScreen={toggleScreen} podeCompartilhar={podeCompartilhar} />
    </div>
  )
}

function ControlsCall({ ctrl, onEncerrar, sharing, onToggleScreen, podeCompartilhar }: {
  ctrl: WebRTCState; onEncerrar?: () => void
  sharing: boolean; onToggleScreen: () => void; podeCompartilhar: boolean
}) {
  return (
    <div className="vc-controls">
      <button
        className={`vc-ctrl${ctrl.micOn ? '' : ' off'}`}
        onClick={() => ctrl.setMicOn(!ctrl.micOn)}
        title={ctrl.micOn ? 'Silenciar microfone' : 'Ativar microfone'}
      >
        {ctrl.micOn ? <Mic size={16} /> : <MicOff size={16} />}
      </button>
      <button
        className={`vc-ctrl${ctrl.camOn ? '' : ' off'}`}
        onClick={() => ctrl.setCamOn(!ctrl.camOn)}
        title={ctrl.camOn ? 'Desligar câmera' : 'Ligar câmera'}
      >
        {ctrl.camOn ? <Video size={16} /> : <VideoOff size={16} />}
      </button>
      {podeCompartilhar && (
        <button
          className={`vc-ctrl${sharing ? ' on' : ''}`}
          onClick={onToggleScreen}
          title={sharing ? 'Parar de compartilhar a tela' : 'Compartilhar a tela'}
        >
          {sharing ? <ScreenShareOff size={16} /> : <ScreenShare size={16} />}
        </button>
      )}
      <button
        className="vc-ctrl danger"
        onClick={() => { ctrl.encerrar(); onEncerrar?.() }}
        title="Sair da chamada"
      >
        <PhoneOff size={16} />
      </button>
    </div>
  )
}
