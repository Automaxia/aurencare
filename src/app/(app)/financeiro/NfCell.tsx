'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StatusNf } from '@/server/services/financeiro'

type Props = {
  sessaoId: string
  pago: boolean        // só mostra editável se foi pago (não-pago = "—")
  status: StatusNf
  numero: string | null
  diasDesdePagamento: number | null
}

const STATUS_LABEL: Record<StatusNf, string> = {
  emitida:    'Emitida',
  pendente:   'Pendente',
  dispensada: 'Dispensada',
}

/** Badge clicável da NF — popover edita status + número. */
export function NfCell(props: Props) {
  const [aberto, setAberto] = useState(false)

  if (!props.pago) {
    return <span style={{ color: 'var(--faint)', fontSize: 12 }}>—</span>
  }

  // Alerta visual: pago há mais de 30 dias e ainda pendente
  const alerta = props.status === 'pendente'
    && props.diasDesdePagamento != null
    && props.diasDesdePagamento >= 30

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className={`badge ${nfColor(props.status, alerta)}`}
        style={{
          cursor: 'pointer', border: 'none', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
        title={alerta ? `Paga há ${props.diasDesdePagamento}d sem NF` : 'Editar Nota Fiscal'}
      >
        {alerta && <span style={{ fontSize: 9 }}>⚠</span>}
        {STATUS_LABEL[props.status]}
        {props.numero && <span style={{ opacity: .8, fontSize: 11 }}>· {props.numero}</span>}
      </button>

      {aberto && (
        <Popover
          sessaoId={props.sessaoId}
          status={props.status}
          numero={props.numero}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  )
}

function nfColor(s: StatusNf, alerta: boolean): string {
  if (s === 'emitida')    return 'sage'
  if (s === 'dispensada') return 'muted'
  return alerta ? 'rose' : 'amber'
}

// ─── Popover ───────────────────────────────────────────────────────

function Popover({ sessaoId, status, numero, onClose }: {
  sessaoId: string
  status: StatusNf
  numero: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [novoStatus, setNovoStatus] = useState<StatusNf>(status)
  const [novoNumero, setNovoNumero] = useState(numero ?? '')
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  async function salvar() {
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/sessao/${sessaoId}/nf`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus,
          numero: novoStatus === 'emitida' ? novoNumero.trim() || null : null,
        }),
      })
      if (!r.ok) { setErro('Falha ao salvar.'); setSalvando(false); return }
      onClose()
      router.refresh()
    } catch {
      setErro('Sem conexão.')
      setSalvando(false)
    }
  }

  return (
    <>
      {/* Backdrop pra fechar ao clicar fora */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 70 }}
      />
      <div
        style={{
          position: 'absolute', top: '100%', left: 0,
          marginTop: 4, zIndex: 71,
          minWidth: 260,
          background: 'white', borderRadius: 10,
          border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(26,24,37,.12)',
          padding: 14,
        }}
      >
        <div style={{
          fontSize: 11, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '.06em',
          marginBottom: 10,
        }}>
          Status da Nota Fiscal
        </div>

        <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
          <Opcao ativo={novoStatus === 'pendente'}   onClick={() => setNovoStatus('pendente')}   label="Pendente" descr="Ainda não emitida" />
          <Opcao ativo={novoStatus === 'emitida'}    onClick={() => setNovoStatus('emitida')}    label="Emitida"   descr="NF já registrada" />
          <Opcao ativo={novoStatus === 'dispensada'} onClick={() => setNovoStatus('dispensada')} label="Dispensada" descr="Sem obrigação" />
        </div>

        {novoStatus === 'emitida' && (
          <label style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Número da NF (opcional)</span>
            <input
              value={novoNumero}
              onChange={e => setNovoNumero(e.target.value)}
              placeholder="ex: 00012345"
              style={{
                padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'white',
                fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </label>
        )}

        {erro && <div style={{ color: 'var(--rose)', fontSize: 11, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost"
            style={{ padding: '6px 12px', fontSize: 12 }}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="btn primary"
            style={{ padding: '6px 12px', fontSize: 12 }}
            disabled={salvando}
          >
            {salvando ? '…' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
  )
}

function Opcao({ ativo, onClick, label, descr }: { ativo: boolean; onClick: () => void; label: string; descr: string }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        textAlign: 'left', padding: '8px 10px', borderRadius: 6,
        background: ativo ? 'rgba(106,78,200,.08)' : 'transparent',
        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 1,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: ativo ? 500 : 400, color: 'var(--ink)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{descr}</span>
    </button>
  )
}
