'use client'

import { useEffect, useState } from 'react'

type Data = { disponivel: boolean; numero?: number; dataHora?: string; resumo?: string; tarefas?: string[] }

/** Pop-up com o resumo curto/médio da sessão anterior + tarefas/plano de ação. */
export function ResumoAnteriorModal({ sessaoId, onClose }: { sessaoId: string; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let cancel = false
    fetch(`/api/sessao/${sessaoId}/anterior`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => { if (!cancel) setData(j) })
      .catch(() => { if (!cancel) setErro(true) })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [sessaoId])

  const dataFmt = data?.dataHora
    ? new Date(data.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div role="dialog" aria-modal="true" aria-label="Resumo da sessão anterior" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,38,.55)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 16, backdropFilter: 'blur(4px)' }}>
      <div className="card" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%', maxHeight: '86vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Sessão anterior</h2>
            {data?.disponivel && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Sessão #{data.numero}{dataFmt ? ` · ${dataFmt}` : ''}
              </div>
            )}
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Fechar" style={{ padding: '3px 10px' }}>✕</button>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Carregando resumo…</div>
          ) : erro ? (
            <div style={{ fontSize: 13, color: 'var(--rose)' }}>Não consegui carregar agora. Tente de novo em instantes.</div>
          ) : !data?.disponivel ? (
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Ainda não há sessão anterior registrada para este paciente. O resumo aparece aqui
              a partir da próxima sessão assinada.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Resumo</div>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>{data.resumo}</p>

              <div style={{ fontSize: 10.5, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontWeight: 600 }}>
                Tarefas · plano de ação combinado
              </div>
              {data.tarefas && data.tarefas.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                  {data.tarefas.map((t, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                      <span style={{ flex: 'none', marginTop: 1, width: 18, height: 18, borderRadius: 5, background: 'rgba(106,78,200,.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>✓</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Nenhuma tarefa ou plano de ação explícito foi registrado na sessão anterior.
                </div>
              )}

              <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>
                Extraído do laudo assinado · revise ao conduzir a sessão · a decisão clínica é sempre sua.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
