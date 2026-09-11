'use client'

import { useState } from 'react'
import { sincronizarTemplatesAction } from './actions'

type Linha = { name: string; status: string | null; rejected_reason?: string | null }

const COR: Record<string, string> = {
  APPROVED: 'var(--sage)',
  PENDING: 'var(--amber)',
  IN_APPEAL: 'var(--amber)',
  REJECTED: 'var(--rose)',
  PAUSED: 'var(--rose)',
  DISABLED: 'var(--rose)',
}

/**
 * Lista os templates do catálogo × o que existe na WABA, e cria os que faltam.
 * Template aprovado é imutável na Meta: pra mudar texto, muda-se o nome no
 * catálogo e sincroniza de novo.
 */
export function TemplatesMeta({ linhas, erroLista }: { linhas: Linha[]; erroLista?: string }) {
  const [estado, setEstado] = useState<'idle' | 'rodando'>('idle')
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null)

  const faltando = linhas.filter(l => !l.status).length

  async function sincronizar() {
    setEstado('rodando'); setRes(null)
    const r = await sincronizarTemplatesAction()
    setEstado('idle')
    const partes = [
      r.criados.length ? `${r.criados.length} criado(s) — entram em análise da Meta (minutos a horas)` : null,
      r.existentes.length ? `${r.existentes.length} já existia(m)` : null,
      r.erros.length ? `${r.erros.length} com erro: ${r.erros.map(e => `${e.name} (${e.erro})`).join('; ')}` : null,
    ].filter(Boolean)
    setRes({ ok: r.ok, msg: partes.join(' · ') || 'Nada a fazer.' })
    if (r.criados.length) setTimeout(() => window.location.reload(), 1500)
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: `4px solid ${faltando ? 'var(--amber)' : 'var(--sage)'}` }}>
      <div className="sec-lbl" style={{ marginBottom: 6 }}>Templates · mensagens fora da janela de 24h</div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 10px', lineHeight: 1.55 }}>
        Na Cloud API, lembrete, cobrança, boas-vindas e pós-sessão só saem se o template correspondente
        estiver <strong>aprovado</strong>. Enquanto isso, o envio falha com erro 132001 no log.
        {erroLista && <> <span style={{ color: 'var(--rose)' }}>Não consegui listar os templates: {erroLista}</span></>}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '4px 16px', marginBottom: 12 }}>
        {linhas.map(l => (
          <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.status ? (COR[l.status] ?? 'var(--muted)') : 'var(--faint)', flexShrink: 0 }} />
            <code style={{ fontSize: 12 }}>{l.name}</code>
            <span style={{ color: 'var(--muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }} title={l.rejected_reason ?? undefined}>
              {l.status ?? 'não criado'}
            </span>
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={sincronizar} disabled={estado === 'rodando' || !!erroLista}>
        {estado === 'rodando' ? 'Sincronizando…' : faltando ? `Criar ${faltando} template(s) na WABA` : 'Sincronizar templates'}
      </button>
      {res && (
        <p style={{ fontSize: 12.5, marginTop: 10, color: res.ok ? 'var(--sage)' : 'var(--rose)', lineHeight: 1.5 }}>
          {res.ok ? '✓ ' : '✕ '}{res.msg}
        </p>
      )}
    </div>
  )
}
