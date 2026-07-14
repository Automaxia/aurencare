'use client'

import { useState } from 'react'
import { Compass } from 'lucide-react'
import { CfpBadge } from '@/components/brand/CfpBadge'
import { iaIndisponivel } from '@/lib/ia'

type Props = {
  sessaoId: string
  numero: number
  pacienteNome: string
  resumoIA: string | null
  /** true quando o laudo automático FALHOU/expirou (IA fora) — mostra retry. */
  resumoIndisponivel?: boolean
  /** true quando não houve transcrição suficiente — não é falha, escreva manual. */
  semTranscricao?: boolean
  pagamentoStatus: string
  sugestaoMarcacao: Array<{ idx: number; mark: string; razao: string }> | null
  sugestaoRisco: { autolesao: string; ideacao: string; plano: string; justificativa: string } | null
  onAplicarMarcacao: () => void
  onAplicarRisco: () => void
  onClose: () => void
}

export function PostSessionModal(p: Props) {
  // Nunca injeta placeholder de IA no textarea; começa vazio se o laudo não veio.
  const [resumo, setResumo] = useState(iaIndisponivel(p.resumoIA) ? '' : (p.resumoIA ?? ''))
  // laudoFalhou = SÓ falha real de IA (mostra retry). Resumo null por falta de
  // transcrição não é falha — tratado à parte (semTranscricao).
  const [laudoFalhou, setLaudoFalhou] = useState(p.resumoIndisponivel === true || (!!p.resumoIA && iaIndisponivel(p.resumoIA)))
  const [carregandoLaudo, setCarregandoLaudo] = useState(false)
  const [laudoMsg, setLaudoMsg] = useState<string | null>(null)

  // Retry: o laudo pode ter sido salvo no servidor mesmo após o timeout do POST.
  async function carregarLaudo() {
    if (carregandoLaudo) return
    setCarregandoLaudo(true); setLaudoMsg(null)
    try {
      const r = await fetch(`/api/sessao/${p.sessaoId}/resumo`).then(r => r.json()).catch(() => null)
      if (r?.disponivel && r.resumo && !iaIndisponivel(r.resumo)) {
        setResumo(r.resumo); setLaudoFalhou(false); setLaudoMsg(null)
      } else {
        setLaudoMsg('O laudo ainda não ficou pronto. Aguarde alguns segundos e tente de novo, ou escreva manualmente.')
      }
    } catch {
      setLaudoMsg('Não consegui buscar o laudo agora. Tente de novo em instantes.')
    } finally {
      setCarregandoLaudo(false)
    }
  }
  // Laudo formal CFP sob demanda (modelo forte). O textarea começa com o resumo
  // curto automático; este botão o substitui pelo laudo estruturado quando pedido.
  const [gerandoLaudoFormal, setGerandoLaudoFormal] = useState(false)
  const [laudoFormalGerado, setLaudoFormalGerado] = useState(false)
  async function gerarLaudoFormal() {
    if (gerandoLaudoFormal) return
    setGerandoLaudoFormal(true); setLaudoMsg(null)
    try {
      const r = await fetch(`/api/sessao/${p.sessaoId}/laudo`, { method: 'POST' }).then(r => r.json()).catch(() => null)
      if (r?.ok && r.resumo) { setResumo(r.resumo); setLaudoFormalGerado(true) }
      else setLaudoMsg(r?.iaIndisponivel ? 'IA indisponível agora — tente em instantes.' : 'Não foi possível gerar o laudo.')
    } catch {
      setLaudoMsg('Falha ao gerar o laudo.')
    } finally {
      setGerandoLaudoFormal(false)
    }
  }
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [marcacaoAplicada, setMarcacaoAplicada] = useState(false)
  const [riscoAplicado, setRiscoAplicado] = useState(false)
  const [cobranca, setCobranca] = useState<{ estado: 'idle' | 'enviando' | 'ok' | 'erro' }>({ estado: 'idle' })

  async function assinar() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/sessao/${p.sessaoId}/assinar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumoFinal: resumo, notaClinica: nota }),
    })
    const json = await res.json().catch(() => ({} as any))
    setLoading(false)
    if (res.ok) {
      setSigned(true)
      setTimeout(p.onClose, 1200)
    } else if (json.error === 'termos_proibidos') {
      setError('O texto contém termos clínicos/diagnósticos que não são permitidos. Reformule antes de assinar.')
    } else {
      setError('Falha ao assinar. Tente novamente.')
    }
  }

  async function reenviarCobranca() {
    if (cobranca.estado === 'enviando') return
    setCobranca({ estado: 'enviando' })
    try {
      const res = await fetch(`/api/sessao/${p.sessaoId}/reenviar-cobranca`, { method: 'POST' })
      setCobranca({ estado: res.ok ? 'ok' : 'erro' })
    } catch {
      setCobranca({ estado: 'erro' })
    }
  }

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: 'rgba(20,16,38,.55)', display: 'grid', placeItems: 'center',
      zIndex: 50, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{ maxWidth: 680, width: '100%', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Pós-sessão</h2>
          <CfpBadge />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 18 }}>
          Sessão #{p.numero} · {p.pacienteNome} ·&nbsp;
          {p.pagamentoStatus === 'pago' ? (
            <span style={{ color: 'var(--sage)' }}>pagamento confirmado</span>
          ) : p.pagamentoStatus === 'isento' ? (
            <span style={{ color: 'var(--muted)' }}>sessão sem cobrança</span>
          ) : cobranca.estado === 'ok' ? (
            <span style={{ color: 'var(--sage)' }}>cobrança reenviada ao paciente ✓</span>
          ) : (
            <button className="btn ghost" style={{ padding: 0, color: cobranca.estado === 'erro' ? 'var(--rose)' : 'var(--amber)' }}
              onClick={reenviarCobranca} disabled={cobranca.estado === 'enviando'}>
              {cobranca.estado === 'enviando' ? 'reenviando…' : cobranca.estado === 'erro' ? 'falhou · tentar reenviar de novo' : 'pagamento pendente · reenviar cobrança'}
            </button>
          )}
        </p>

        {laudoFalhou && (
          <div style={{ background: 'var(--amber-lo, rgba(176,125,64,.10))', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
            O rascunho automático não apareceu agora — pode ter demorado mais que o normal pra gerar. Tente carregar o laudo, ou escreva o resumo manualmente abaixo e assine normalmente.
            <div style={{ marginTop: 8 }}>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--amber)' }}
                onClick={carregarLaudo} disabled={carregandoLaudo}>
                {carregandoLaudo ? 'Carregando…' : '↻ Tentar carregar o laudo gerado'}
              </button>
            </div>
            {laudoMsg && <div style={{ marginTop: 6, color: 'var(--muted)' }}>{laudoMsg}</div>}
          </div>
        )}

        {!laudoFalhou && p.semTranscricao && !resumo.trim() && (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            Esta sessão não teve transcrição suficiente para um rascunho automático. Escreva o resumo manualmente abaixo e assine normalmente.
          </div>
        )}

        {/* Sugestões IA — banner com ação de aplicar */}
        {p.sugestaoMarcacao && p.sugestaoMarcacao.length > 0 && !marcacaoAplicada && (
          <SuggestionBanner
            title={`A Audere sugere ${p.sugestaoMarcacao.length} marcações na transcrição`}
            detail={p.sugestaoMarcacao.slice(0, 3).map(m => `[${m.idx}] ${labelMark(m.mark)} — ${m.razao}`).join(' · ')}
            onApply={() => { p.onAplicarMarcacao(); setMarcacaoAplicada(true) }}
          />
        )}
        {p.sugestaoRisco && !riscoAplicado && (
          <SuggestionBanner
            title="A Audere sugere avaliação de risco"
            detail={`Autolesão: ${riskLabel(p.sugestaoRisco.autolesao)} · Ideação: ${riskLabel(p.sugestaoRisco.ideacao)} · Plano: ${riskLabel(p.sugestaoRisco.plano)} — ${p.sugestaoRisco.justificativa}`}
            onApply={() => { p.onAplicarRisco(); setRiscoAplicado(true) }}
          />
        )}

        {!laudoFormalGerado && resumo.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>O texto abaixo é o resumo automático. Para o documento formal (CFP):</span>
            <button className="btn ghost sm" onClick={gerarLaudoFormal} disabled={gerandoLaudoFormal} style={{ color: 'var(--accent)' }}>
              {gerandoLaudoFormal ? 'Gerando laudo…' : '✦ Gerar laudo formal (CFP)'}
            </button>
          </div>
        )}
        <Field label={laudoFormalGerado ? 'Laudo formal (CFP) · revise antes de assinar' : 'Resumo da sessão (automático) · revise antes de assinar'}>
          <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={8} placeholder="Resumo da sessão…" />
        </Field>

        <Field label="Nota clínica privada (opcional)">
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={4} placeholder="Observações que ficam só para você…" />
        </Field>

        {error && <div style={{ color: 'var(--rose)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {signed && <div style={{ color: 'var(--sage)', fontSize: 13, marginBottom: 12 }}>✓ Documento assinado e arquivado.</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn ghost" onClick={p.onClose} disabled={loading}>Fechar sem assinar</button>
          <button className="btn primary" onClick={assinar} disabled={loading || signed || resumo.trim().length === 0}>
            {loading ? 'Assinando…' : signed ? 'Assinado' : 'Assinar documento'}
          </button>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
          A tecnologia cuida do contexto. <span style={{ color: 'var(--muted)' }}>O psicólogo cuida da pessoa.</span>
        </p>

        <style jsx>{`
          textarea {
            width: 100%; padding: 10px 12px; border-radius: var(--field-radius);
            border: 1px solid var(--field-border); background: var(--field-bg);
            font-family: inherit; font-size: 13px; color: var(--ink);
            outline: none; resize: vertical;
            transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
          }
          textarea:hover { border-color: var(--field-border-hover); }
          textarea:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
          textarea:user-invalid { border-color: var(--rose); }
          textarea:user-invalid:focus { box-shadow: var(--field-ring-error); }
        `}</style>
      </div>
    </div>
  )
}

function SuggestionBanner({ title, detail, onApply }: { title: string; detail: string; onApply: () => void }) {
  return (
    <div style={{
      background: 'var(--accent-lo)', borderRadius: 10, padding: '10px 14px', marginBottom: 12,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#391d96', marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Compass size={13} /> {title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{detail}</div>
      </div>
      <button className="btn" style={{ background: 'white', whiteSpace: 'nowrap' }} onClick={onApply}>Aplicar</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
    </label>
  )
}

function labelMark(m: string) {
  return ({ insight: 'Insight', comportamento: 'Comportamento', avanco: 'Avanço' } as Record<string, string>)[m] ?? m
}
function riskLabel(v: string) {
  return ({ lo: 'Baixo', md: 'Médio', hi: 'Alto' } as Record<string, string>)[v] ?? v
}
