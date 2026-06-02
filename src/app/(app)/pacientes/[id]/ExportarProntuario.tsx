'use client'

import { useState } from 'react'
import { ProntuarioIaChat } from './ProntuarioIaChat'

type Aba = 'relatorio' | 'ia'

export type SessaoOpcao = {
  id: string
  numero: number
  dataHora: string
  modalidade: string
  duracaoMin: number
}

type Props = {
  pacienteId: string
  sessoesAssinadas: SessaoOpcao[]
}

/**
 * Modal de exportação com duas abas:
 *   · Relatório de sessão — formato CFP, uma sessão por documento (RELATO2).
 *   · Gerar com IA       — chat conversacional, documento narrativo.
 */
export function ExportarProntuario({ pacienteId, sessoesAssinadas }: Props) {
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<Aba>('relatorio')

  return (
    <>
      <button
        type="button" className="btn ghost"
        onClick={() => setAberto(true)}
        title="Exportar relatório / prontuário"
      >
        ⤓ Relatório
      </button>

      {aberto && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setAberto(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(20,16,38,.55)', backdropFilter: 'blur(4px)',
            display: 'grid', placeItems: 'center', padding: 16,
          }}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: aba === 'ia' ? 720 : 540,
              width: '100%', padding: 28,
              maxHeight: '90vh', overflowY: 'auto',
              transition: 'max-width .2s var(--ease)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
                margin: 0,
              }}>Exportar documento clínico</h3>
              <button
                type="button"
                onClick={() => setAberto(false)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 18, padding: 0,
                }}
                title="Fechar"
              >×</button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 4, marginTop: 16, marginBottom: 22,
              borderBottom: '1px solid var(--border)',
            }}>
              <TabBtn ativo={aba === 'relatorio'} onClick={() => setAba('relatorio')}>
                Relatório de sessão
              </TabBtn>
              <TabBtn ativo={aba === 'ia'} onClick={() => setAba('ia')}>
                Gerar com IA <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 4 }}>NOVO</span>
              </TabBtn>
            </div>

            {aba === 'relatorio' && <AbaRelatorio sessoes={sessoesAssinadas} />}
            {aba === 'ia'        && <ProntuarioIaChat pacienteId={pacienteId} />}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tab btn ─────────────────────────────────────────────────────

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: '10px 16px', background: 'transparent',
        border: 'none', borderBottom: `2px solid ${ativo ? 'var(--accent)' : 'transparent'}`,
        marginBottom: '-1px',
        color: ativo ? 'var(--accent)' : 'var(--muted)',
        fontFamily: 'inherit', fontSize: 13,
        fontWeight: ativo ? 500 : 400,
        cursor: 'pointer', transition: 'all .15s var(--ease)',
        display: 'flex', alignItems: 'center',
      }}
    >
      {children}
    </button>
  )
}

// ─── Aba: Relatório de sessão ─────────────────────────────────────

function AbaRelatorio({ sessoes }: { sessoes: SessaoOpcao[] }) {
  const [sessaoId, setSessaoId] = useState(sessoes[0]?.id ?? '')
  const [gerando, setGerando] = useState(false)

  function baixar() {
    if (!sessaoId) return
    setGerando(true)
    try {
      const url = `/api/sessao/${sessaoId}/relatorio`
      const w = window.open(url, '_blank', 'noopener')
      if (!w) window.location.href = url
      setTimeout(() => setGerando(false), 600)
    } catch {
      setGerando(false)
    }
  }

  if (sessoes.length === 0) {
    return (
      <div style={{
        padding: 18, borderRadius: 10,
        background: 'rgba(196,96,122,.06)', border: '1px solid rgba(196,96,122,.20)',
        fontSize: 13, color: 'var(--rose)', lineHeight: 1.55,
      }}>
        Não há sessões assinadas ainda. Assine uma sessão para gerar o relatório.
      </div>
    )
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
        Documento por sessão em conformidade com a Resolução CFP nº 06/2019.
        Identificação, demanda e objetivos, registro de evolução e encerramento — assinado eletronicamente.
      </p>

      <label style={{ display: 'grid', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Sessão
        </span>
        <select
          value={sessaoId}
          onChange={e => setSessaoId(e.target.value)}
          style={{
            padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'white',
            fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
          }}
        >
          {sessoes.map(s => (
            <option key={s.id} value={s.id}>
              #{s.numero} · {formatDataHora(s.dataHora)} · {s.duracaoMin}min · {s.modalidade}
            </option>
          ))}
        </select>
      </label>

      <div style={{
        padding: 12, borderRadius: 8,
        background: 'var(--surface)', marginBottom: 18,
        fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6,
      }}>
        <strong>{sessoes.length}</strong> {sessoes.length === 1 ? 'sessão assinada disponível' : 'sessões assinadas disponíveis'} — selecione qual exportar.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button" className="btn primary"
          onClick={baixar} disabled={gerando || !sessaoId}
        >
          {gerando ? 'Gerando…' : '⤓ Baixar relatório'}
        </button>
      </div>

      <p style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center', marginTop: 16, lineHeight: 1.55 }}>
        Em fiscalização presencial, o Conselho Regional pode solicitar versão impressa.
        Imprimir diretamente do PDF é aceito.
      </p>
    </>
  )
}

function formatDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
