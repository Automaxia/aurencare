'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TranscriptionCard, type Turno, type TurnMark, type TurnTone } from './widgets/TranscriptionCard'
import { RhythmWidget } from './widgets/RhythmWidget'
import { ThemesCanvas } from './widgets/ThemesCanvas'
import { HumorCheck, initialHumor, type HumorState } from './widgets/HumorCheck'
import { RiskAssessment } from './widgets/RiskAssessment'
import { PostSessionModal } from './widgets/PostSessionModal'
import { useSpeech } from './useSpeech'
import { useContexto, UltimaSessaoWidget, TopicosWidget, InfoPacienteWidget } from './widgets/ContextWidgets'
import { SortableGrid } from './widgets/SortableGrid'
import { WidgetGrip } from '@/components/WidgetGrip'

type Props = {
  sessaoId: string
  pacienteId: string
  pacienteNome: string
  numeroSessao: number
  duracaoMin: number
  pagamentoStatus: string
}

const DEFAULT_ORDER = ['ritmo', 'temas', 'humor', 'info', 'risco', 'ultima', 'topicos', 'nota']

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
  const [humor, setHumor] = useState<HumorState>(initialHumor)
  const [notaRapida, setNotaRapida] = useState('')

  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    fetch(`/api/sessao/${props.sessaoId}/iniciar`, { method: 'POST' }).catch(() => {})
  }, [props.sessaoId])

  useEffect(() => {
    const id = setInterval(() => setTempo(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const { ctx, loading: ctxLoading } = useContexto(props.sessaoId)

  const { supported, active, error, forceSpeakerToggle } = useSpeech({
    enabled: recording,
    onFinal: chunk => {
      const id = crypto.randomUUID()
      setTurnos(prev => [...prev, { id, who: chunk.who, texto: chunk.texto, ts: chunk.ts, mark: null, tone: null }])
      setInterim('')
      classificarTom(id, chunk.texto, chunk.who)
    },
    onInterim: setInterim,
  })

  async function classificarTom(turnoId: string, texto: string, who: 'psicologo' | 'paciente') {
    if (texto.length < 12) return
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/ia/tom-turno`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, who }),
      })
      const json = await r.json()
      const tone = json?.tone as TurnTone | undefined
      if (tone) setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, tone } : t))
    } catch { /* */ }
  }

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

  const contagem = turnos.reduce<{ psic: number; pac: number }>((acc, t) => {
    acc[t.who === 'psicologo' ? 'psic' : 'pac'] += t.texto.split(/\s+/).length
    return acc
  }, { psic: 0, pac: 0 })
  const total = contagem.psic + contagem.pac
  const pctPsic = total ? Math.round((contagem.psic / total) * 100) : 50
  const pctPac  = total ? 100 - pctPsic : 50

  const counts: Record<TurnMark, number> = { insight: 0, comportamento: 0, avanco: 0 }
  for (const t of turnos) if (t.mark) counts[t.mark]++

  async function encerrar() {
    if (encerrando) return
    setEncerrando(true)
    setRecording(false)
    const transcricao = transcricaoCompleta()
    const indicadores = {
      ritmo: { psicologo: pctPsic, paciente: pctPac },
      humor, risco, notaRapida,
    }

    const res = await fetch(`/api/sessao/${props.sessaoId}/encerrar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcricao, indicadores }),
    })
    const json = await res.json().catch(() => ({} as any))
    setResumoIA(json.resumo ?? null)

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

  const widgets = [
    <RhythmWidget key="ritmo" pctPsic={pctPsic} pctPac={pctPac} counts={counts} armed={armed} setArmed={setArmed} />,
    <div key="temas" className="themes-card" data-widget-id="temas">
      <WidgetGrip />
      <div className="themes-head"><span className="ttl">Temas desta sessão</span><span className="sub">ao vivo</span></div>
      <div style={{ padding: 8 }}><ThemesCanvas turnos={turnos} /></div>
    </div>,
    <HumorCheck key="humor" value={humor} onChange={setHumor} />,
    <InfoPacienteWidget key="info" ctx={ctx} loading={ctxLoading} pacienteId={props.pacienteId} />,
    <RiskAssessment key="risco" value={risco} onChange={setRisco} />,
    <UltimaSessaoWidget key="ultima" ctx={ctx} loading={ctxLoading} />,
    <TopicosWidget key="topicos" ctx={ctx} loading={ctxLoading} />,
    <div key="nota" className="qnote wide" data-widget-id="nota">
      <WidgetGrip />
      <div className="sp-t">Nota rápida</div>
      <textarea
        placeholder="Algo para lembrar depois…"
        value={notaRapida}
        onChange={e => setNotaRapida(e.target.value)}
      />
    </div>,
  ]

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
          Seu navegador não suporta transcrição nativa. Use Chrome ou Edge.
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(176,125,64,.10)', color: 'var(--amber)', padding: '8px 16px', fontSize: 12 }}>
          Reconhecimento: {error}
        </div>
      )}

      <div className="sess-wrap">
        <TranscriptionCard
          turnos={turnos}
          interim={interim}
          armed={armed} setArmed={setArmed}
          onMark={marcarTurno}
          onToggleWho={alternarFalante}
          recording={recording}
        />

        <div className="sess-right">
          <SortableGrid defaultOrder={DEFAULT_ORDER}>
            {widgets}
          </SortableGrid>
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
