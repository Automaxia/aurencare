'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { useWebRTC, type WebRTCState } from '@/lib/useWebRTC'

type Props = {
  token: string
  role: 'psicologo' | 'paciente'
  caller: boolean
  /** Layout enxuto pra embutir no Modo Presença */
  compact?: boolean
  /** Quando encerrar, callback (opcional) */
  onEncerrar?: () => void
  /** Notifica quando o stream remoto (do outro lado) muda. Usado pra plumbar
   * o áudio do paciente pra transcrição AssemblyAI no Modo Presença. */
  onRemoteStream?: (stream: MediaStream | null) => void
}

export function VideoCall({ token, role, caller, compact, onEncerrar, onRemoteStream }: Props) {
  const ctrl = useWebRTC({ token, role, caller })
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)

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

  useEffect(() => {
    if (localRef.current && ctrl.localStream) localRef.current.srcObject = ctrl.localStream
  }, [ctrl.localStream])
  useEffect(() => {
    if (remoteRef.current && ctrl.remoteStream) remoteRef.current.srcObject = ctrl.remoteStream
    onRemoteStream?.(ctrl.remoteStream)
  }, [ctrl.remoteStream, onRemoteStream])

  return (
    <div className={`vc-shell${compact ? ' vc-compact' : ''}`} data-estado={ctrl.estado}>
      <div className="vc-remote">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: '#0e0c18' }}
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

      <ControlsCall ctrl={ctrl} onEncerrar={onEncerrar} />
    </div>
  )
}

function ControlsCall({ ctrl, onEncerrar }: { ctrl: WebRTCState; onEncerrar?: () => void }) {
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
