'use client'

import { useState } from 'react'
import { responderConfirmacaoAction } from './actions'

type Props = {
  token: string
  pacienteNome: string
  psicologaNome: string
  dataHora: string
  numero: number
  respostaAtual: string | null
  janelaExpiraEm: string | null
}

export function ConfirmarClient(props: Props) {
  const [resposta, setResposta] = useState<string | null>(props.respostaAtual)
  const [enviando, setEnviando] = useState<'sim' | 'contestou' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const janelaExpirou = props.janelaExpiraEm && new Date(props.janelaExpiraEm) < new Date()
  const ja = resposta === 'sim' || resposta === 'contestou'

  async function responder(r: 'sim' | 'contestou') {
    if (enviando || ja) return
    setEnviando(r); setErro(null)
    const res = await responderConfirmacaoAction(props.token, r)
    setEnviando(null)
    if (res.ok) {
      setResposta(res.resposta)
    } else {
      setErro({
        token_invalido: 'Link inválido. Talvez já tenha sido respondido.',
        janela_expirada: 'A janela de confirmação já passou. O pagamento foi liberado automaticamente.',
        sessao_invalida: 'Sessão inválida.',
      }[res.razao])
    }
  }

  const horaSessao = new Date(props.dataHora).toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  // Estados terminais
  if (resposta === 'sim') return (
    <Card>
      <Pip color="sage">✓</Pip>
      <h1 style={titulo}>Confirmação registrada</h1>
      <p style={corpo}>Obrigada por confirmar a sessão. Bom descanso.</p>
    </Card>
  )
  if (resposta === 'contestou') return (
    <Card>
      <Pip color="rose">!</Pip>
      <h1 style={titulo}>Recebemos seu retorno</h1>
      <p style={corpo}>
        Vamos avaliar e entrar em contato em até 1 dia útil. O pagamento ficou em análise.
      </p>
    </Card>
  )
  if (resposta === 'silencio' || janelaExpirou) return (
    <Card>
      <Pip color="muted">⏱</Pip>
      <h1 style={titulo}>Janela encerrada</h1>
      <p style={corpo}>
        O prazo de confirmação passou e o pagamento foi liberado automaticamente.
        Se precisar relatar algo, fale com sua psicóloga ou pelo nosso suporte.
      </p>
    </Card>
  )

  return (
    <Card>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>
        Sessão #{props.numero}
      </p>
      <h1 style={titulo}>Sua sessão ocorreu como combinado?</h1>
      <p style={corpo}>
        <strong>{props.pacienteNome.split(' ')[0]}</strong>, sua sessão com {props.psicologaNome} em <strong>{horaSessao}</strong>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        <button
          className="btn primary"
          onClick={() => responder('sim')}
          disabled={!!enviando}
          style={{ justifyContent: 'center', padding: '12px' }}
        >
          {enviando === 'sim' ? 'Confirmando…' : 'SIM, ocorreu normalmente'}
        </button>
        <button
          className="btn ghost"
          onClick={() => responder('contestou')}
          disabled={!!enviando}
          style={{ justifyContent: 'center', padding: '12px', color: 'var(--rose)' }}
        >
          {enviando === 'contestou' ? 'Enviando…' : 'NÃO, quero relatar algo'}
        </button>
      </div>

      {erro && (
        <div style={{
          marginTop: 16, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(196,96,122,.08)', color: 'var(--rose)', fontSize: 12, lineHeight: 1.5,
        }}>{erro}</div>
      )}

      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 20, lineHeight: 1.6, textAlign: 'center' }}>
        Sua resposta é registrada com data, hora e IP para garantir clareza pra todos.
      </p>
    </Card>
  )
}

const titulo: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 24, fontWeight: 400,
  margin: '6px 0 10px', color: 'var(--ink)',
}
const corpo: React.CSSProperties = {
  color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, margin: 0,
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ padding: 28 }}>{children}</div>
}

function Pip({ color, children }: { color: 'sage' | 'rose' | 'muted'; children: React.ReactNode }) {
  const bg = ({
    sage: 'rgba(90,158,138,.14)',
    rose: 'rgba(196,96,122,.14)',
    muted: 'var(--surface)',
  } as const)[color]
  const fg = ({ sage: 'var(--sage)', rose: 'var(--rose)', muted: 'var(--muted)' } as const)[color]
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', background: bg, color: fg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 500, marginBottom: 12,
    }}>
      {children}
    </div>
  )
}
