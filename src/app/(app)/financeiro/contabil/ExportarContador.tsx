'use client'

import { useState } from 'react'

/**
 * Botão "Exportar pro contador" + modal com seletor de mês e formato.
 *
 * Default: mês corrente, PDF.
 * Gera dois cliques no mesmo modal (CSV ou PDF) sem fechar.
 */
export function ExportarContador() {
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState(() => mesIsoAtual())
  const [gerandoCsv, setGerandoCsv] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  function baixar(formato: 'csv' | 'pdf') {
    const url = `/api/financeiro/exportar?mes=${mes}&formato=${formato}`
    if (formato === 'csv') setGerandoCsv(true); else setGerandoPdf(true)
    try {
      const w = window.open(url, '_blank', 'noopener')
      if (!w) window.location.href = url
    } finally {
      setTimeout(() => {
        if (formato === 'csv') setGerandoCsv(false); else setGerandoPdf(false)
      }, 800)
    }
  }

  return (
    <>
      <button
        type="button" className="btn primary"
        onClick={() => setAberto(true)}
      >
        ⤓ Exportar pro contador
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
            style={{ maxWidth: 480, width: '100%', padding: 28 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
                margin: 0,
              }}>Exportar pro contador</h3>
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

            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0 18px', lineHeight: 1.55 }}>
              Gera um relatório do mês escolhido com identificação, regime tributário, totais
              e detalhamento das cobranças pagas. Pronto pra enviar ao seu contador.
            </p>

            <label style={{ display: 'grid', gap: 4, marginBottom: 18 }}>
              <span style={{
                fontSize: 11, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>Mês de referência</span>
              <input
                type="month"
                value={mes}
                onChange={e => setMes(e.target.value)}
                style={{
                  padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'white',
                  fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
                }}
              />
            </label>

            <div style={{ display: 'grid', gap: 10 }}>
              <FormatoBtn
                ativo
                onClick={() => baixar('pdf')}
                disabled={gerandoPdf || gerandoCsv}
                icone="⤓"
                titulo={gerandoPdf ? 'Gerando PDF…' : 'Baixar como PDF'}
                subtitulo="Relatório formal com identificação, totais e tabela detalhada"
              />
              <FormatoBtn
                onClick={() => baixar('csv')}
                disabled={gerandoPdf || gerandoCsv}
                icone="⤓"
                titulo={gerandoCsv ? 'Gerando CSV…' : 'Baixar como CSV'}
                subtitulo="Planilha (separador ;) compatível com Excel e Receita Saúde"
              />
            </div>

            <p style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center', marginTop: 18, lineHeight: 1.55 }}>
              Estimativas pra orientação · Cálculo final é responsabilidade do(a) contador(a).
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function FormatoBtn({ ativo, onClick, disabled, icone, titulo, subtitulo }: {
  ativo?: boolean
  onClick: () => void
  disabled?: boolean
  icone: string
  titulo: string
  subtitulo: string
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        textAlign: 'left', padding: 14, borderRadius: 10,
        background: ativo ? 'rgba(106,78,200,.06)' : 'var(--card)',
        border: `1.5px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
        cursor: disabled ? 'wait' : 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14,
        transition: 'all .15s var(--ease)',
        opacity: disabled ? .7 : 1,
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 8,
        background: ativo ? 'var(--accent)' : 'var(--surface)',
        color: ativo ? 'white' : 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>{icone}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{titulo}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitulo}</div>
      </div>
    </button>
  )
}

function mesIsoAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
