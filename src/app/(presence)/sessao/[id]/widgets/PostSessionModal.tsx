'use client'

import { useState } from 'react'
import { CfpBadge } from '@/components/brand/CfpBadge'

type Props = {
  sessaoId: string
  numero: number
  pacienteNome: string
  resumoIA: string | null
  pagamentoStatus: string
  sugestaoMarcacao: Array<{ idx: number; mark: string; razao: string }> | null
  sugestaoRisco: { autolesao: string; ideacao: string; plano: string; justificativa: string } | null
  onAplicarMarcacao: () => void
  onAplicarRisco: () => void
  onClose: () => void
}

export function PostSessionModal(p: Props) {
  const [resumo, setResumo] = useState(p.resumoIA ?? '')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [marcacaoAplicada, setMarcacaoAplicada] = useState(false)
  const [riscoAplicado, setRiscoAplicado] = useState(false)

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
    await fetch(`/api/sessao/${p.sessaoId}/reenviar-cobranca`, { method: 'POST' })
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
          ) : (
            <button className="btn ghost" style={{ padding: 0, color: 'var(--amber)' }} onClick={reenviarCobranca}>
              pagamento pendente · reenviar cobrança
            </button>
          )}
        </p>

        {/* Sugestões IA — banner com ação de aplicar */}
        {p.sugestaoMarcacao && p.sugestaoMarcacao.length > 0 && !marcacaoAplicada && (
          <SuggestionBanner
            title={`IA sugere ${p.sugestaoMarcacao.length} marcações na transcrição`}
            detail={p.sugestaoMarcacao.slice(0, 3).map(m => `[${m.idx}] ${labelMark(m.mark)} — ${m.razao}`).join(' · ')}
            onApply={() => { p.onAplicarMarcacao(); setMarcacaoAplicada(true) }}
          />
        )}
        {p.sugestaoRisco && !riscoAplicado && (
          <SuggestionBanner
            title="IA sugere avaliação de risco"
            detail={`Autolesão: ${riskLabel(p.sugestaoRisco.autolesao)} · Ideação: ${riskLabel(p.sugestaoRisco.ideacao)} · Plano: ${riskLabel(p.sugestaoRisco.plano)} — ${p.sugestaoRisco.justificativa}`}
            onApply={() => { p.onAplicarRisco(); setRiscoAplicado(true) }}
          />
        )}

        <Field label="Resumo (rascunho gerado · revise antes de assinar)">
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

        <style jsx>{`
          textarea {
            width: 100%; padding: 10px 12px; border-radius: 8px;
            border: 1px solid var(--border); background: white;
            font-family: inherit; font-size: 13px; color: var(--ink);
            outline: none; resize: vertical;
          }
          textarea:focus { border-color: var(--accent); }
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
        <div style={{ fontSize: 12, fontWeight: 500, color: '#391d96', marginBottom: 2 }}>🧭 {title}</div>
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
