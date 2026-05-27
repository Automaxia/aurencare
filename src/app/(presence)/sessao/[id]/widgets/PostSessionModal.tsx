'use client'

import { useState } from 'react'
import { CfpBadge } from '@/components/brand/CfpBadge'

type Props = {
  sessaoId: string
  numero: number
  pacienteNome: string
  resumoIA: string | null
  pagamentoStatus: string
  onClose: () => void
}

export function PostSessionModal(p: Props) {
  const [resumo, setResumo] = useState(p.resumoIA ?? '')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)

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
      <div className="card" style={{ maxWidth: 620, width: '100%', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
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

        <Field label="Resumo (rascunho gerado · revise antes de assinar)">
          <textarea
            value={resumo}
            onChange={e => setResumo(e.target.value)}
            rows={8}
            placeholder="Resumo da sessão…"
          />
        </Field>

        <Field label="Nota clínica privada (opcional)">
          <textarea
            value={nota}
            onChange={e => setNota(e.target.value)}
            rows={4}
            placeholder="Observações que ficam só para você…"
          />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
    </label>
  )
}
