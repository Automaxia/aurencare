'use client'

import { useEffect, useRef } from 'react'
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
}

export function VideoCall({ token, role, caller, compact, onEncerrar }: Props) {
  const ctrl = useWebRTC({ token, role, caller })
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localRef.current && ctrl.localStream) localRef.current.srcObject = ctrl.localStream
  }, [ctrl.localStream])
  useEffect(() => {
    if (remoteRef.current && ctrl.remoteStream) remoteRef.current.srcObject = ctrl.remoteStream
  }, [ctrl.remoteStream])

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
