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
import { useSpeech } from './useSpeech'

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
  const [interim, setInterim] = useState('')
  const [armed, setArmed] = useState<TurnMark | null>(null)
  const [tempoSegundos, setTempo] = useState(0)
  const [recording, setRecording] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [resumoIA, setResumoIA] = useState<string | null>(null)
  const [sugestaoTurnos, setSugestaoTurnos] = useState<Array<{ idx: number; mark: TurnMark; razao: string }> | null>(null)
  const [sugestaoRisco, setSugestaoRisco] = useState<{ autolesao: 'lo'|'md'|'hi'; ideacao: 'lo'|'md'|'hi'; plano: 'lo'|'md'|'hi'; justificativa: string } | null>(null)
  const [risco, setRisco] = useState<{ autolesao: 'lo'|'md'|'hi'; ideacao: 'lo'|'md'|'hi'; plano: 'lo'|'md'|'hi' }>({ autolesao: 'lo', ideacao: 'lo', plano: 'lo' })
  const [humor, setHumor] = useState<{ inicio: number; meio: number; fim: number }>({ inicio: 0, meio: 0, fim: 0 })
  const [notaRapida, setNotaRapida] = useState('')

  const startedRef = useRef(false)

  // marca em_curso ao montar
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

  // ── Transcrição real (Web Speech API nativa do navegador) ─────────────
  const { supported, active, error, forceSpeakerToggle } = useSpeech({
    enabled: recording,
    onFinal: chunk => {
      setTurnos(prev => [
        ...prev,
        { id: crypto.randomUUID(), who: chunk.who, texto: chunk.texto, ts: chunk.ts, mark: null },
      ])
      setInterim('')
    },
    onInterim: setInterim,
  })

  function marcarTurno(id: string) {
    if (!armed) return
    setTurnos(prev => prev.map(t => t.id === id ? { ...t, mark: armed } : t))
  }

  function alternarFalante(id: string) {
    setTurnos(prev => prev.map(t => t.id === id
      ? { ...t, who: t.who === 'psicologo' ? 'paciente' : 'psicologo' }
      : t,
    ))
  }

  function transcricaoCompleta(): string {
    return turnos.map(t => `${t.who === 'psicologo' ? 'P' : 'C'}: ${t.texto}`).join('\n')
  }

  // Ritmo (palavras por turno)
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
    setRecording(false)
    const transcricao = transcricaoCompleta()
    const indicadores = { ritmo: { psicologo: pctPsic, paciente: pctPac }, humor, risco, notaRapida }

    // 1) encerra e gera resumo IA
    const res = await fetch(`/api/sessao/${props.sessaoId}/encerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcricao, indicadores }),
    })
    const json = await res.json().catch(() => ({} as any))
    setResumoIA(json.resumo ?? null)

    // 2) em paralelo, pede sugestão de marcação + risco
    if (transcricao.length > 60) {
      Promise.all([
        fetch(`/api/sessao/${props.sessaoId}/ia/marcar-turnos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turnos: turnos.map((t, i) => ({ idx: i, who: t.who, texto: t.texto })) }),
        }).then(r => r.json()).then(j => setSugestaoTurnos(j?.marcacoes ?? null)).catch(() => {}),

        fetch(`/api/sessao/${props.sessaoId}/ia/risco`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcricao }),
        }).then(r => r.json()).then(j => setSugestaoRisco(j ?? null)).catch(() => {}),
      ])
    }

    setEncerrando(false)
    setShowPostModal(true)
  }

  function aplicarSugestaoMarcacao() {
    if (!sugestaoTurnos) return
    setTurnos(prev => prev.map((t, i) => {
      const sug = sugestaoTurnos.find(s => s.idx === i)
      return sug ? { ...t, mark: t.mark ?? sug.mark } : t
    }))
  }
  function aplicarSugestaoRisco() {
    if (!sugestaoRisco) return
    setRisco({ autolesao: sugestaoRisco.autolesao, ideacao: sugestaoRisco.ideacao, plano: sugestaoRisco.plano })
  }

  return (
    <>
      <div className="pbar">
        <div>
          <span className="pb-name">{props.pacienteNome}</span>
          <span className="pb-meta">
            · Sessão {props.numeroSessao} · {recording ? (active ? 'Presente' : 'Iniciando…') : 'Pausado'} · {fmtTime(tempoSegundos)}
          </span>
        </div>
        <div className="pb-actions">
          {!recording ? (
            <button className="btn" onClick={() => setRecording(true)}>● Iniciar registro</button>
          ) : (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sage)' }}>
                <span className="rp-dot animate-pulse" /> {active ? 'Presente' : '...'}
              </span>
              <button className="btn ghost" onClick={forceSpeakerToggle} title="Forçar troca de falante no próximo turno">↺ P/C</button>
              <button className="btn ghost" onClick={() => setRecording(false)}>⏸</button>
            </>
          )}
          <button className="btn primary" onClick={encerrar} disabled={encerrando}>
            {encerrando ? 'Encerrando…' : 'Encerrar'}
          </button>
          <a className="btn ghost" href="/">← Voltar</a>
        </div>
      </div>

      {supported === false && (
        <div style={{ background: 'var(--rose-lo)', color: 'var(--rose)', padding: '8px 16px', fontSize: 12 }}>
          Seu navegador não suporta a transcrição nativa. Use Chrome ou Safari, ou configure ASSEMBLYAI_API_KEY para fallback.
        </div>
      )}
      {error && (
        <div style={{ background: 'var(--amber-lo)', color: 'var(--amber)', padding: '8px 16px', fontSize: 12 }}>
          Reconhecimento: {error} — permita o microfone e clique &quot;Iniciar registro&quot; novamente.
        </div>
      )}

      <div className="sess-layout">
        <TranscriptionCard
          turnos={turnos}
          interim={interim}
          armed={armed} setArmed={setArmed}
          onMark={marcarTurno}
          onToggleWho={alternarFalante}
        />

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
          sugestaoMarcacao={sugestaoTurnos}
          sugestaoRisco={sugestaoRisco}
          onAplicarMarcacao={aplicarSugestaoMarcacao}
          onAplicarRisco={aplicarSugestaoRisco}
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
