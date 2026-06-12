'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { editarCobrancaAction, removerCobrancaAction } from './actions'

const STATUS_OPCOES: { v: string; label: string }[] = [
  { v: 'pago', label: 'Pago' },
  { v: 'pendente', label: 'Pendente' },
  { v: 'reembolsado', label: 'Reembolsado' },
  { v: 'isento', label: 'Sem cobrança' },
  { v: 'falhou', label: 'Falhou' },
  { v: 'contestado', label: 'Contestado' },
]

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function GerirCobranca({ sessaoId, valor, pagamentoStatus, dataHora, paciente }: {
  sessaoId: string; valor: number; pagamentoStatus: string; dataHora: string; paciente: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState(pagamentoStatus)
  const [valorStr, setValorStr] = useState(String(valor))
  const [data, setData] = useState(() => toLocalInput(dataHora))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function abrir() {
    setStatus(pagamentoStatus); setValorStr(String(valor)); setData(toLocalInput(dataHora))
    setErro(null); setAberto(true)
  }

  async function salvar() {
    setErro(null)
    const v = parseFloat(valorStr.replace(',', '.'))
    if (isNaN(v) || v < 0) { setErro('Valor inválido.'); return }
    setSalvando(true)
    const r = await editarCobrancaAction(sessaoId, {
      pagamentoStatus: status,
      valor: v,
      dataHora: new Date(data).toISOString(),
    })
    setSalvando(false)
    if (!r.ok) { setErro(r.error ?? 'Não foi possível salvar.'); return }
    setAberto(false); router.refresh()
  }

  async function apagar() {
    if (!confirm(`Remover a cobrança de ${paciente}? A sessão é marcada como "sem cobrança" (valor R$ 0). O registro clínico é preservado.`)) return
    setSalvando(true)
    await removerCobrancaAction(sessaoId)
    setSalvando(false)
    setAberto(false); router.refresh()
  }

  return (
    <>
      <button onClick={abrir} className="btn ghost" style={{ fontSize: 11, padding: '3px 9px' }}>Gerir</button>

      {aberto && (
        <div role="dialog" aria-modal="true" onClick={() => !salvando && setAberto(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(20,16,38,.5)', backdropFilter: 'blur(3px)',
          display: 'grid', placeItems: 'center', zIndex: 60, padding: 16,
        }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(380px, 94vw)', padding: 22 }}>
            <h3 style={{ margin: '0 0 2px' }}>Gerir cobrança</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px' }}>{paciente}</p>

            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Status de pagamento</span>
                <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
                  {STATUS_OPCOES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Valor (R$)</span>
                <input value={valorStr} onChange={e => setValorStr(e.target.value)} inputMode="decimal" style={inp} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Data e hora</span>
                <input type="datetime-local" value={data} onChange={e => setData(e.target.value)} style={inp} />
              </label>
            </div>

            {erro && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 10 }}>{erro}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 8 }}>
              <button onClick={apagar} disabled={salvando} style={{
                fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--rose) 38%, transparent)',
                background: 'transparent', color: 'var(--rose)', cursor: 'pointer',
              }}>Apagar cobrança</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setAberto(false)} disabled={salvando} className="btn ghost">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="btn primary">{salvando ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const cap: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}
