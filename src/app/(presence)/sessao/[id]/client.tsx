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
import { LiveInsight } from './widgets/LiveInsight'
import { VideoCall } from '@/components/video/VideoCall'
import { Video } from 'lucide-react'

type Props = {
  sessaoId: string
  pacienteId: string
  pacienteNome: string
  numeroSessao: number
  duracaoMin: number
  pagamentoStatus: string
}

const DEFAULT_ORDER = ['live-insight', 'ritmo', 'temas', 'humor', 'info', 'risco', 'ultima', 'topicos', 'nota']
const OBS_INTERVAL_TURNS = 5  // gera observação a cada N turnos novos

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
  const [obsViva, setObsViva] = useState<string | null>(null)
  const [obsLoading, setObsLoading] = useState(false)
  const [chamada, setChamada] = useState<{ token: string; urlPaciente: string } | null>(null)
  const [mostrarModalSala, setMostrarModalSala] = useState(false)
  const [iniciandoChamada, setIniciandoChamada] = useState(false)

  const startedRef = useRef(false)
  // turnos onde o falante foi manualmente fixado (não sobreescrever via IA)
  const manualWhoRef = useRef<Set<string>>(new Set())
  // controle de quando rodar próxima observação ao vivo
  const lastObsAtCountRef = useRef<number>(0)

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
      // IA classifica em paralelo: tom + falante (atribuição correta) — fire-and-forget
      classificarTom(id, chunk.texto)
      classificarFalante(id, chunk.texto)
    },
    onInterim: setInterim,
  })

  async function classificarTom(turnoId: string, texto: string) {
    if (texto.length < 12) return
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/ia/tom-turno`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, who: 'paciente' }),
      })
      const json = await r.json()
      const tone = json?.tone as TurnTone | undefined
      if (tone) setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, tone } : t))
    } catch { /* */ }
  }

  /**
   * Classifica o falante via IA. Respeita override manual (turnos que o
   * usuário clicou pra mudar P/C ficam fixos — não sobreescrevemos).
   */
  async function classificarFalante(turnoId: string, texto: string) {
    if (texto.length < 6) return
    // contexto: últimos 3 turnos já confirmados
    const ctx = turnos.slice(-3).map(t => ({ who: t.who, texto: t.texto }))
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/ia/falante`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, contexto: ctx }),
      })
      const json = await r.json()
      const who = json?.who as 'psicologo' | 'paciente' | undefined
      if (!who) return
      setTurnos(prev => prev.map(t => {
        if (t.id !== turnoId) return t
        if (manualWhoRef.current.has(turnoId)) return t   // não sobrescreve override manual
        if (t.who === who) return t                       // já está certo
        return { ...t, who }
      }))
    } catch { /* */ }
  }

  function marcarTurno(id: string) {
    if (!armed) return
    setTurnos(prev => prev.map(t => t.id === id ? { ...t, mark: armed } : t))
  }
  function alternarFalante(id: string) {
    manualWhoRef.current.add(id)   // bloqueia futuras reatribuições da IA
    setTurnos(prev => prev.map(t => t.id === id
      ? { ...t, who: t.who === 'psicologo' ? 'paciente' : 'psicologo' }
      : t,
    ))
  }

  /**
   * Observação ao vivo — regenera a cada OBS_INTERVAL_TURNS novos turnos.
   */
  useEffect(() => {
    if (turnos.length === 0) {
      setObsViva(null)
      lastObsAtCountRef.current = 0
      return
    }
    if (turnos.length - lastObsAtCountRef.current < OBS_INTERVAL_TURNS) return
    lastObsAtCountRef.current = turnos.length
    setObsLoading(true)
    fetch(`/api/sessao/${props.sessaoId}/ia/observacao-viva`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnos: turnos.map(t => ({ who: t.who, texto: t.texto })) }),
    })
      .then(r => r.json())
      .then(j => setObsViva(j?.text ?? null))
      .catch(() => {})
      .finally(() => setObsLoading(false))
  }, [turnos.length, props.sessaoId])

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

  async function iniciarChamada() {
    if (iniciandoChamada || chamada) { setMostrarModalSala(true); return }
    setIniciandoChamada(true)
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/sala`, { method: 'POST' })
      if (!r.ok) throw new Error('sala falhou')
      const j = await r.json()
      setChamada({ token: j.token, urlPaciente: j.urlPaciente })
      setMostrarModalSala(true)
    } catch {
      alert('Não foi possível abrir a chamada agora.')
    } finally {
      setIniciandoChamada(false)
    }
  }

  const widgets = [
    <LiveInsight key="live-insight" text={obsViva} loading={obsLoading} numeroTurnos={turnos.length} />,
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
          <button
            className={`btn${chamada ? ' primary' : ' ghost'}`}
            onClick={iniciarChamada}
            disabled={iniciandoChamada}
            title={chamada ? 'Mostrar link da sala' : 'Abrir chamada online no Auren'}
          >
            <Video size={14} style={{ marginRight: 4 }} />
            {chamada ? 'Sala online' : iniciandoChamada ? 'Abrindo…' : 'Chamada online'}
          </button>
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

      {/* Modal pra mostrar URL pro paciente */}
      {mostrarModalSala && chamada && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(20,16,38,.55)', display: 'grid', placeItems: 'center',
          zIndex: 60, padding: 16, backdropFilter: 'blur(4px)',
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 4px' }}>Sala da sessão</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Envie este link pro paciente entrar. Sua chamada abre em uma janela embutida quando ambos estiverem na sala.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={chamada.urlPaciente}
                readOnly
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  fontSize: 12, fontFamily: 'var(--font-mono), monospace',
                }}
              />
              <button className="btn primary" onClick={() => navigator.clipboard?.writeText(chamada.urlPaciente)}>
                Copiar
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--faint)' }}>
              Sala ativa por 4 horas. Quando você fechar a chamada, pode reabri-la aqui.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setMostrarModalSala(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* VideoCall overlay quando chamada ativa */}
      {chamada && (
        <div style={{
          position: 'fixed', right: 20, bottom: 20,
          width: 360, height: 260, zIndex: 40,
          boxShadow: 'var(--sh-lg)', borderRadius: 'var(--rsm)',
          overflow: 'hidden',
        }}>
          <VideoCall token={chamada.token} role="psicologo" caller compact onEncerrar={() => setChamada(null)} />
        </div>
      )}

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
