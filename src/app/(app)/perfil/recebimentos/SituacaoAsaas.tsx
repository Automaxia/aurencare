'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { atualizarSituacaoAction } from './actions'

type Situacao = 'pendente' | 'em_analise' | 'aprovado' | 'recusado'
type Etapas = { commercialInfo?: string; bankAccountInfo?: string; documentation?: string; general?: string } | null

/** O que a situação significa para quem atende — e o que fazer. */
const SITUACAO: Record<Situacao, { rotulo: string; tag: string; texto: string }> = {
  aprovado: {
    rotulo: 'Aprovada', tag: 't-ok',
    texto: 'Sua conta está liberada. O valor das sessões cai nela e os saques são feitos pelo Asaas.',
  },
  em_analise: {
    rotulo: 'Em análise', tag: 't-info',
    texto: 'O Asaas está analisando seus dados. Você já pode cobrar normalmente — os saques ficam liberados quando a análise terminar.',
  },
  pendente: {
    rotulo: 'Aguardando documentos', tag: 't-warn',
    texto: 'Falta enviar documentos no Asaas. Você já pode cobrar, mas só consegue sacar depois da aprovação.',
  },
  recusado: {
    rotulo: 'Recusada', tag: 't-alert',
    texto: 'O Asaas recusou o cadastro. Enquanto isso, a cobrança pela plataforma fica pausada: as sessões são agendadas com o pagamento combinado direto com o paciente. Veja o motivo no e-mail do Asaas ou fale com o suporte.',
  },
}

const ETAPAS: Array<{ chave: keyof NonNullable<Etapas>; rotulo: string }> = [
  { chave: 'commercialInfo', rotulo: 'Dados comerciais' },
  { chave: 'documentation', rotulo: 'Documentos' },
  { chave: 'bankAccountInfo', rotulo: 'Conta para saque' },
  { chave: 'general', rotulo: 'Análise geral' },
]

const STATUS_ETAPA: Record<string, { rotulo: string; tag: string }> = {
  APPROVED: { rotulo: 'Aprovado', tag: 't-ok' },
  AWAITING_APPROVAL: { rotulo: 'Em análise', tag: 't-info' },
  PENDING: { rotulo: 'Pendente', tag: 't-warn' },
  REJECTED: { rotulo: 'Recusado', tag: 't-alert' },
}

export function SituacaoAsaas({ situacao, etapas, email }: { situacao: Situacao | null; etapas: Etapas; email: string | null }) {
  const router = useRouter()
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const s = SITUACAO[situacao ?? 'pendente']

  async function atualizar() {
    setConsultando(true); setErro(null)
    const r = await atualizarSituacaoAction()
    setConsultando(false)
    if (r.ok) router.refresh()
    else setErro(r.error ?? 'Falha ao consultar.')
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div className="sec-lbl">Conta de recebimento no Asaas</div>
        <span className={`tag ${s.tag}`}>{s.rotulo}</span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.texto}</p>

      {etapas && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {ETAPAS.map(e => {
            const st = STATUS_ETAPA[etapas[e.chave] ?? ''] ?? { rotulo: '—', tag: '' }
            return (
              <div key={e.chave} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 10px', borderRadius: 8, background: 'var(--surface)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{e.rotulo}</span>
                <span className={`tag ${st.tag}`}>{st.rotulo}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{
        padding: '10px 12px', borderRadius: 8, background: 'rgba(106,78,200,.06)',
        fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6,
      }}>
        O acesso à sua conta chega por e-mail{email ? <> em <strong>{email}</strong></> : ''}. Por lá você envia
        os documentos, cadastra a conta bancária para saque e faz os saques — a Audere não guarda dados bancários.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        {erro && <span style={{ fontSize: 12, color: 'var(--rose)', marginRight: 'auto' }}>{erro}</span>}
        <button type="button" className="btn ghost sm" onClick={atualizar} disabled={consultando}>
          {consultando ? 'Consultando…' : 'Atualizar situação'}
        </button>
      </div>
    </div>
  )
}
