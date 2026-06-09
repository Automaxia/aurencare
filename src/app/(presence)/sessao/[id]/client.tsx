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
import { useRemoteTranscribe } from './useRemoteTranscribe'
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
const TOM_BATCH_SIZE = 5      // classifica o tom em lotes de N turnos (1 chamada IA)
const TOM_BATCH_MS = 3500     // …ou ao fim deste intervalo, o que vier primeiro

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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [pacienteInterim, setPacienteInterim] = useState('')
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [bloqueio, setBloqueio] = useState<{ cap: number; usadas: number; plano: string } | null>(null)
  // mic local do psicólogo — só usado como FALLBACK quando o Web Speech não existe
  // (iPad/Safari/Firefox). Aí roteamos o mic local pela AssemblyAI (igual ao paciente).
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null)

  const startedRef = useRef(false)
  // controle de quando rodar próxima observação ao vivo
  const lastObsAtCountRef = useRef<number>(0)
  // últimos finais do mic local (psicóloga) — janela curta pra dedupe contra eco do alto-falante
  const recentLocalRef = useRef<Array<{ id: string; texto: string; ts: number }>>([])
  // fila de classificação de tom — agrupa turnos pra classificar em lote (1 chamada/lote)
  const tomQueueRef = useRef<Array<{ id: string; texto: string; who: 'psicologo' | 'paciente' }>>([])
  const tomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    fetch(`/api/sessao/${props.sessaoId}/iniciar`, { method: 'POST' }).catch(() => {})
  }, [props.sessaoId])

  useEffect(() => {
    const id = setInterval(() => setTempo(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // limpa o timer do lote de tom ao desmontar (evita flush após sair da tela)
  useEffect(() => () => { if (tomTimerRef.current) clearTimeout(tomTimerRef.current) }, [])

  const { ctx, loading: ctxLoading } = useContexto(props.sessaoId)

  // Adiciona um turno do psicólogo (usado tanto pelo Web Speech quanto pelo
  // fallback AssemblyAI). Memoriza no buffer de dedup vs eco do alto-falante.
  function addPsicologoTurn(texto: string, ts: string) {
    const id = crypto.randomUUID()
    const tsMs = Date.parse(ts) || Date.now()
    const win = recentLocalRef.current.filter(r => tsMs - r.ts < 6000)
    win.push({ id, texto, ts: tsMs })
    recentLocalRef.current = win.slice(-8)
    setTurnos(prev => [...prev, { id, who: 'psicologo', texto, ts, mark: null, tone: null }])
    setInterim('')
    enqueueTom(id, texto, 'psicologo')
  }

  const { supported, active, error } = useSpeech({
    enabled: recording,
    onFinal: chunk => addPsicologoTurn(chunk.texto, chunk.ts),
    onInterim: setInterim,
  })

  // Fallback: onde o Web Speech não existe (supported === false), captura o mic
  // local do psicólogo e o transcreve pela AssemblyAI. Em navegadores com Web
  // Speech (desktop), isto fica desligado — mantém a transcrição local grátis.
  useEffect(() => {
    if (!(recording && supported === false)) return
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
        stream = s
        setLocalMicStream(s)
      })
      .catch(() => { /* permissão negada — banner de erro já cobre */ })
    return () => {
      cancelled = true
      stream?.getTracks().forEach(t => t.stop())
      setLocalMicStream(null)
    }
  }, [recording, supported])

  const localFallbackSTT = useRemoteTranscribe({
    enabled: recording && supported === false && !!localMicStream,
    stream: localMicStream,
    onFinal: (texto, ts) => addPsicologoTurn(texto, ts),
    onInterim: setInterim,
  })

  // STT do paciente — pega o áudio remoto do WebRTC e manda direto pra AssemblyAI.
  // Turnos do paciente entram já com who='paciente' fixo.
  // Dedup (psicólogo→paciente): o mic local da psicóloga é a fonte autoritativa
  // da fala dela. Se o mic do paciente captou a voz da psicóloga pelo alto-falante
  // (eco residual), esse texto chega aqui como "paciente" mas é cópia de um turno
  // recente da psicóloga — descartamos pra não contaminar a análise do paciente.
  const remoteSTT = useRemoteTranscribe({
    enabled: recording && !!remoteStream,
    stream: remoteStream,
    onFinal: (texto, ts) => {
      const tsMs = Date.parse(ts) || Date.now()
      const win = recentLocalRef.current.filter(r => tsMs - r.ts < 6000)
      recentLocalRef.current = win
      // É eco da psicóloga vazando no mic do paciente? Então não é fala do paciente.
      const ehEcoDaPsicologa = win.some(r => similarity(r.texto, texto) >= 0.7)
      if (ehEcoDaPsicologa) { setPacienteInterim(''); return }

      const id = crypto.randomUUID()
      setTurnos(prev => [...prev, { id, who: 'paciente', texto, ts, mark: null, tone: null }])
      setPacienteInterim('')
      enqueueTom(id, texto, 'paciente')
    },
    onInterim: setPacienteInterim,
  })

  // Enfileira um turno pra classificação de tom em lote. Dispara o flush quando
  // o lote enche (TOM_BATCH_SIZE) ou após TOM_BATCH_MS — o que vier primeiro.
  function enqueueTom(turnoId: string, texto: string, who: 'psicologo' | 'paciente') {
    if (texto.length < 12) return
    tomQueueRef.current.push({ id: turnoId, texto, who })
    if (tomQueueRef.current.length >= TOM_BATCH_SIZE) {
      flushTom()
    } else if (!tomTimerRef.current) {
      tomTimerRef.current = setTimeout(flushTom, TOM_BATCH_MS)
    }
  }

  async function flushTom() {
    if (tomTimerRef.current) { clearTimeout(tomTimerRef.current); tomTimerRef.current = null }
    const lote = tomQueueRef.current
    if (lote.length === 0) return
    tomQueueRef.current = []
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/ia/tom-turno`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnos: lote.map(t => ({ texto: t.texto, who: t.who })) }),
      })
      const json = await r.json()
      const tones = (json?.tones ?? []) as Array<TurnTone | null>
      setTurnos(prev => prev.map(t => {
        const idx = lote.findIndex(l => l.id === t.id)
        const tone = idx >= 0 ? tones[idx] : null
        return tone ? { ...t, tone } : t
      }))
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

  /**
   * Observação ao vivo — regenera a cada OBS_INTERVAL_TURNS novos turnos.
   */
  useEffect(() => {
    // Análise do paciente: a observação ao vivo considera SOMENTE as falas do
    // paciente (não as intervenções da psicóloga).
    const turnosPaciente = turnos.filter(t => t.who === 'paciente')
    if (turnosPaciente.length === 0) {
      setObsViva(null)
      lastObsAtCountRef.current = 0
      return
    }
    if (turnosPaciente.length - lastObsAtCountRef.current < OBS_INTERVAL_TURNS) return
    lastObsAtCountRef.current = turnosPaciente.length
    setObsLoading(true)
    fetch(`/api/sessao/${props.sessaoId}/ia/observacao-viva`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnos: turnosPaciente.map(t => ({ who: t.who, texto: t.texto })) }),
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

  // Inicia o registro (transcrição/IA) após passar pelo gate de cota mensal.
  async function iniciarRegistro() {
    try {
      const r = await fetch(`/api/sessao/${props.sessaoId}/ia/iniciar`, { method: 'POST' })
      if (r.status === 403) {
        const j = await r.json().catch(() => ({}))
        setBloqueio({ cap: j?.cap ?? 0, usadas: j?.usadas ?? 0, plano: j?.plano ?? 'free' })
        return
      }
    } catch { /* rede instável: deixa gravar mesmo assim, não trava o atendimento */ }
    setBloqueio(null)
    setRecording(true)
  }

  async function encerrar() {
    if (encerrando) return
    setEncerrando(true)
    setRecording(false)
    flushTom()  // classifica o tom do último lote pendente antes de fechar
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
      <div style={{ padding: 8 }}><ThemesCanvas turnos={turnos.filter(t => t.who === 'paciente')} /></div>
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
            <button className="btn" onClick={iniciarRegistro}>● Iniciar registro</button>
          ) : (
            <button className="btn ghost" onClick={() => setRecording(false)}>⏸</button>
          )}
          <button
            className={`btn${chamada ? ' primary' : ' ghost'}`}
            onClick={iniciarChamada}
            disabled={iniciandoChamada}
            title={chamada ? 'Mostrar link da sala' : 'Abrir chamada online no Audere'}
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

      {bloqueio && (
        <div style={{ background: 'var(--rose-lo)', color: 'var(--rose)', padding: '10px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <span>
            Você atingiu o limite de <strong>{bloqueio.cap} sessões com IA</strong> do plano {bloqueio.plano} este mês.
            A agenda e o prontuário seguem normais; o registro com IA volta no próximo ciclo.
          </span>
          <a className="btn primary" href="/planos" style={{ whiteSpace: 'nowrap' }}>Fazer upgrade</a>
        </div>
      )}

      {supported === false && (
        localFallbackSTT.error ? (
          <div style={{ background: 'var(--rose-lo)', color: 'var(--rose)', padding: '8px 16px', fontSize: 12 }}>
            Transcrição indisponível neste navegador: {localFallbackSTT.error}
          </div>
        ) : (
          <div style={{ background: 'rgba(90,158,138,.10)', color: '#2a6456', padding: '8px 16px', fontSize: 12 }}>
            Transcrição em nuvem ativa neste dispositivo (sem Web Speech).
          </div>
        )
      )}
      {error && (
        <div style={{ background: 'rgba(176,125,64,.10)', color: 'var(--amber)', padding: '8px 16px', fontSize: 12 }}>
          Reconhecimento: {error}
        </div>
      )}
      {remoteSTT.error && (
        <div style={{ background: 'rgba(176,125,64,.10)', color: 'var(--amber)', padding: '8px 16px', fontSize: 12 }}>
          Transcrição do paciente: {remoteSTT.error}
        </div>
      )}

      <div className="sess-wrap">
        <TranscriptionCard
          turnos={turnos}
          interim={pacienteInterim || interim}
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
              <button
                className={`btn ${linkCopiado ? 'sage' : 'primary'}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(chamada.urlPaciente)
                    setLinkCopiado(true)
                    setTimeout(() => setLinkCopiado(false), 2000)
                  } catch { /* clipboard bloqueado — ignora silenciosamente */ }
                }}
                style={{ minWidth: 96, justifyContent: 'center' }}
              >
                {linkCopiado ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--faint)' }}>
              Sala ativa por 4 horas. Quando você fechar a chamada, pode reabri-la aqui.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn ghost" onClick={() => { setMostrarModalSala(false); setLinkCopiado(false) }}>Fechar</button>
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
          <VideoCall
            token={chamada.token}
            role="psicologo"
            caller
            compact
            onEncerrar={() => { setChamada(null); setRemoteStream(null) }}
            onRemoteStream={setRemoteStream}
          />
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

/**
 * Similaridade de Jaccard sobre palavras normalizadas (≥3 letras).
 * Web Speech e AssemblyAI transcrevem a mesma fala com pequenas
 * diferenças (pontuação, acentos, eufônicos); Jaccard é tolerante
 * o suficiente sem precisar de Levenshtein. Threshold 0.7 acerta
 * eco e ignora frases coincidentemente parecidas.
 */
const COMBINING_MARKS = /[̀-ͯ]/g
function similarity(a: string, b: string): number {
  const tok = (s: string) => new Set(
    s.toLowerCase()
      .normalize('NFD').replace(COMBINING_MARKS, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3),
  )
  const A = tok(a), B = tok(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}
