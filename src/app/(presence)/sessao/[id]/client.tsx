'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CfpBadge } from '@/components/brand/CfpBadge'
import { TranscriptionCard, type Turno, type TurnMark } from './widgets/TranscriptionCard'
import { RhythmWidget } from './widgets/RhythmWidget'
import { ThemesCanvas } from './widgets/ThemesCanvas'
import { HumorCheck } from './widgets/HumorCheck'
import { RiskAssessment } from './widgets/RiskAssessment'
import { PostSessionModal } from './widgets/PostSessionModal'

type Props = {
  sessaoId: string
  pacienteNome: string
  numeroSessao: number
  duracaoMin: number
  pagamentoStatus: string
}

export function PresenceClient(props: Props) {
  const router = useRouter()
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [armed, setArmed] = useState<TurnMark | null>(null)
  const [tempoSegundos, setTempo] = useState(0)
  const [recording, setRecording] = useState(false)
  const [microError, setMicError] = useState<string | null>(null)
  const [encerrando, setEncerrando] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [resumoIA, setResumoIA] = useState<string | null>(null)
  const [risco, setRisco] = useState<{ autolesao: 'lo'|'md'|'hi'; ideacao: 'lo'|'md'|'hi'; plano: 'lo'|'md'|'hi' }>({ autolesao: 'lo', ideacao: 'lo', plano: 'lo' })
  const [humor, setHumor] = useState<{ inicio: number; meio: number; fim: number }>({ inicio: 0, meio: 0, fim: 0 })
  const [notaRapida, setNotaRapida] = useState('')

  const startedRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // marca sessão como em_curso ao montar (uma vez)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    fetch(`/api/sessao/${props.sessaoId}/iniciar`, { method: 'POST' }).catch(() => {})
  }, [props.sessaoId])

  // timer
  useEffect(() => {
    const id = setInterval(() => setTempo(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // captura áudio + envia chunks de 5s
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mr

      mr.ondataavailable = async (e) => {
        if (!e.data || e.data.size < 1024) return
        const ab = await e.data.arrayBuffer()
        try {
          const res = await fetch(`/api/sessao/${props.sessaoId}/transcrever`, {
            method: 'POST',
            body: ab,
            headers: { 'Content-Type': 'application/octet-stream' },
          })
          const json = await res.json()
          if (json.texto) appendTurnoFromText(json.texto)
        } catch { /* ignore */ }
      }

      // emite chunk a cada 5s
      mr.start(5000)
      setRecording(true)
    } catch (err) {
      setMicError('Não consegui acessar o microfone. Verifique permissões.')
      // fallback demo: turnos sintéticos a cada 4s
      startDemoMode()
    }
  }

  function startDemoMode() {
    setRecording(true)
    if (demoTimerRef.current) return
    demoTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessao/${props.sessaoId}/transcrever`, { method: 'POST' })
        const json = await res.json()
        if (json.texto) appendTurnoFromText(json.texto)
      } catch { /* */ }
    }, 4000)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null }
    setRecording(false)
  }

  function appendTurnoFromText(raw: string) {
    // protocolo demo: "[P] texto" ou "[C] texto"; caso contrário, alterna.
    const m = raw.match(/^\[(P|C)\]\s*(.+)$/)
    const who: 'psicologo' | 'paciente' = m
      ? (m[1] === 'P' ? 'psicologo' : 'paciente')
      : (turnos.length % 2 === 0 ? 'psicologo' : 'paciente')
    const texto = m ? m[2] : raw
    setTurnos(prev => [
      ...prev,
      { id: crypto.randomUUID(), who, texto, ts: new Date().toISOString(), mark: null },
    ])
  }

  function marcarTurno(id: string) {
    if (!armed) return
    setTurnos(prev => prev.map(t => t.id === id ? { ...t, mark: armed } : t))
  }

  function transcricaoCompleta(): string {
    return turnos.map(t => `${t.who === 'psicologo' ? 'P' : 'C'}: ${t.texto}`).join('\n')
  }

  // contagem para Ritmo (% por turno × duração média estimada)
  const contagem = turnos.reduce<{ psic: number; pac: number }>((acc, t) => {
    acc[t.who === 'psicologo' ? 'psic' : 'pac'] += t.texto.split(/\s+/).length
    return acc
  }, { psic: 0, pac: 0 })
  const total = contagem.psic + contagem.pac
  const pctPsic = total ? Math.round((contagem.psic / total) * 100) : 50
  const pctPac  = total ? 100 - pctPsic : 50

  async function encerrar() {
    if (encerrando) return
    setEncerrando(true)
    stopRecording()
    const indicadores = {
      ritmo: { psicologo: pctPsic, paciente: pctPac },
      humor,
      risco,
      notaRapida,
    }
    const res = await fetch(`/api/sessao/${props.sessaoId}/encerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcricao: transcricaoCompleta(), indicadores }),
    })
    const json = await res.json().catch(() => ({} as any))
    setResumoIA(json.resumo ?? null)
    setEncerrando(false)
    setShowPostModal(true)
  }

  return (
    <>
      <div className="pbar">
        <div>
          <span className="pb-name">{props.pacienteNome}</span>
          <span className="pb-meta">
            · Sessão {props.numeroSessao} · {recording ? 'Presente' : 'Pausado'} · {fmtTime(tempoSegundos)}
          </span>
        </div>
        <div className="pb-actions">
          {!recording ? (
            <button className="btn" onClick={startRecording}>● Iniciar registro</button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sage)' }}>
              <span className="rp-dot animate-pulse" /> Presente
            </span>
          )}
          <button className="btn primary" onClick={encerrar} disabled={encerrando}>
            {encerrando ? 'Encerrando…' : 'Encerrar'}
          </button>
          <a className="btn ghost" href="/">← Voltar</a>
        </div>
      </div>

      {microError && (
        <div style={{ background: 'var(--rose-lo)', color: 'var(--rose)', padding: '8px 16px', fontSize: 12 }}>
          {microError} — Rodando em modo demo (turnos sintéticos a cada 4s).
        </div>
      )}

      <div className="sess-layout">
        <TranscriptionCard turnos={turnos} armed={armed} setArmed={setArmed} onMark={marcarTurno} />

        <div className="sess-right">
          <RhythmWidget pctPsic={pctPsic} pctPac={pctPac} />

          <div className="widget themes-card" data-widget-id="temas">
            <div className="widget-grip" aria-hidden="true">⠿</div>
            <div className="widget-title">Temas desta sessão</div>
            <ThemesCanvas turnos={turnos} />
          </div>

          <HumorCheck humor={humor} onChange={setHumor} />

          <div className="widget" data-widget-id="info">
            <div className="widget-grip" aria-hidden="true">⠿</div>
            <div className="widget-title">Informações do paciente</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>
          </div>

          <RiskAssessment value={risco} onChange={setRisco} />

          <div className="widget wide" data-widget-id="ultima">
            <div className="widget-grip" aria-hidden="true">⠿</div>
            <div className="widget-title">Última sessão</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>
          </div>

          <div className="widget" data-widget-id="topicos">
            <div className="widget-grip" aria-hidden="true">⠿</div>
            <div className="widget-title">Tópicos em aberto</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>
          </div>

          <div className="widget qnote" data-widget-id="nota">
            <div className="widget-grip" aria-hidden="true">⠿</div>
            <div className="widget-title">Nota rápida</div>
            <textarea
              placeholder="Escrever observação livre…"
              value={notaRapida}
              onChange={e => setNotaRapida(e.target.value)}
            />
          </div>

          <div className="widget wide" data-widget-id="cfp">
            <CfpBadge />
          </div>
        </div>
      </div>

      {showPostModal && (
        <PostSessionModal
          sessaoId={props.sessaoId}
          numero={props.numeroSessao}
          pacienteNome={props.pacienteNome}
          resumoIA={resumoIA}
          pagamentoStatus={props.pagamentoStatus}
          onClose={() => { setShowPostModal(false); router.push('/') }}
        />
      )}
    </>
  )
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
