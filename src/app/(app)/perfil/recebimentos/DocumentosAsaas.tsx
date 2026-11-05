'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { documentosAction, enviarDocumentoAction } from './actions'
import type { DocumentosSubconta, GrupoDocumento } from '@/server/lib/pagamentos/asaas/documentos'

const STATUS: Record<string, { rotulo: string; tag: string }> = {
  NOT_SENT: { rotulo: 'Não enviado', tag: 't-warn' },
  PENDING: { rotulo: 'Em análise', tag: 't-info' },
  APPROVED: { rotulo: 'Aprovado', tag: 't-ok' },
  REJECTED: { rotulo: 'Recusado — reenvie', tag: 't-alert' },
  IGNORED: { rotulo: 'Dispensado', tag: '' },
}

/**
 * "Enviar documentos" da subconta Asaas. Busca a lista na hora do clique: o
 * link de envio (identificação + selfie) expira e muda quando um envio é
 * recusado. Documentos sem link são enviados como arquivo por aqui.
 */
export function DocumentosAsaas({ email }: { email: string | null }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DocumentosSubconta | null>(null)

  async function carregar() {
    setCarregando(true); setErro(null)
    const r = await documentosAction()
    setCarregando(false)
    if (r.ok) { setDados(r.dados); setAberto(true) }
    else setErro(r.error)
  }

  if (!aberto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary sm" onClick={carregar} disabled={carregando}>
          {carregando ? 'Consultando o Asaas…' : 'Enviar documentos'}
        </button>
        {erro && <span style={{ fontSize: 12, color: 'var(--rose)' }}>{erro}</span>}
      </div>
    )
  }

  const pendentes = (dados?.grupos ?? []).filter(g => g.status !== 'APPROVED' && g.status !== 'IGNORED')

  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Documentos pedidos pelo Asaas</div>
        <button type="button" className="btn ghost sm" onClick={carregar} disabled={carregando}>
          {carregando ? 'Consultando…' : 'Recarregar'}
        </button>
      </div>

      {dados?.motivoRecusa && (
        <div style={{ fontSize: 12, color: 'var(--rose)', lineHeight: 1.6 }}>
          Motivo informado pelo Asaas: {dados.motivoRecusa}
        </div>
      )}

      {pendentes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
          Nenhum documento pendente. Se a situação ainda não mudou, o Asaas está analisando o que você enviou
          (a selfie costuma ser aprovada em minutos; o resto, em até 48 h).
        </p>
      ) : (
        pendentes.map(g => <ItemDocumento key={g.id} grupo={g} email={email} aoEnviar={() => { carregar(); router.refresh() }} />)
      )}
      {erro && <span style={{ fontSize: 12, color: 'var(--rose)' }}>{erro}</span>}
    </div>
  )
}

function ItemDocumento({ grupo, email, aoEnviar }: { grupo: GrupoDocumento; email: string | null; aoEnviar: () => void }) {
  const st = STATUS[grupo.status] ?? { rotulo: grupo.status, tag: '' }
  const input = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const podeEnviar = grupo.status === 'NOT_SENT' || grupo.status === 'REJECTED'

  async function enviar(arquivo: File) {
    setEnviando(true); setMsg(null)
    const fd = new FormData()
    fd.append('grupoId', grupo.id)
    fd.append('arquivo', arquivo)
    const r = await enviarDocumentoAction(fd)
    setEnviando(false)
    if (input.current) input.current.value = ''
    if (r.ok) { setMsg({ ok: true, texto: 'Enviado. O Asaas vai analisar.' }); aoEnviar() }
    else setMsg({ ok: false, texto: r.error })
  }

  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>{grupo.titulo}</div>
          {grupo.responsavel && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>De: {grupo.responsavel}</div>}
        </div>
        <span className={`tag ${st.tag}`}>{st.rotulo}</span>
      </div>

      {grupo.onboardingUrl ? (
        podeEnviar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn primary sm" href={grupo.onboardingUrl} target="_blank" rel="noopener noreferrer">
              Enviar pelo Asaas ↗
            </a>
            <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Abre a página segura do Asaas: foto do documento e selfie. Dá para fazer pelo celular.
            </span>
          </div>
        )
      ) : grupo.tipo.startsWith('IDENTIFICATION') ? (
        podeEnviar && (
          <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            O Asaas ainda não liberou o link de envio deste documento. Use o aplicativo do Asaas ou o acesso
            enviado por e-mail{email ? <> para <strong>{email}</strong></> : ''}.
          </span>
        )
      ) : (
        podeEnviar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              ref={input} type="file" accept="application/pdf,image/jpeg,image/png" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) enviar(f) }}
            />
            <button type="button" className="btn sm" onClick={() => input.current?.click()} disabled={enviando}>
              {enviando ? 'Enviando…' : grupo.status === 'REJECTED' ? 'Enviar de novo' : 'Escolher arquivo'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>PDF, JPG ou PNG, até 3,8 MB.</span>
          </div>
        )
      )}

      {msg && <span style={{ fontSize: 12, color: msg.ok ? 'var(--sage)' : 'var(--rose)' }}>{msg.texto}</span>}
    </div>
  )
}
