'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  atualizarPacienteAction, arquivarPacienteAction,
  reativarPacienteAction, excluirPacienteAction,
} from './actions'

type Props = {
  pacienteId: string
  inicial: {
    nome: string
    telefone: string
    email: string | null
    status: 'ativo' | 'inativo'
  }
  totalSessoes: number
}

type Modal = null | 'editar' | 'arquivar' | 'reativar' | 'excluir'

/** Botão "⋯" com menu de ações + modais correspondentes. */
export function AcoesPaciente({ pacienteId, inicial, totalSessoes }: Props) {
  const [aberto, setAberto] = useState(false)
  const [modal, setModal] = useState<Modal>(null)

  function abrir(m: Modal) { setAberto(false); setModal(m) }

  const arquivado = inicial.status === 'inativo'

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          type="button" className="btn ghost"
          onClick={() => setAberto(a => !a)}
          title="Ações do paciente"
          style={{ padding: '6px 12px' }}
        >
          ⋯
        </button>
        {aberto && (
          <>
            <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 71,
              minWidth: 200, background: 'white', borderRadius: 10,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(26,24,37,.10)',
              overflow: 'hidden',
            }}>
              <ItemMenu icone="✎" label="Editar dados" onClick={() => abrir('editar')} />
              {!arquivado
                ? <ItemMenu icone="⊘" label="Arquivar" onClick={() => abrir('arquivar')} />
                : <ItemMenu icone="↻" label="Reativar" onClick={() => abrir('reativar')} />
              }
              <ItemMenu
                icone="×" label="Excluir definitivamente"
                onClick={() => abrir('excluir')}
                vermelho
              />
            </div>
          </>
        )}
      </div>

      {modal === 'editar' && (
        <ModalEditar
          pacienteId={pacienteId}
          inicial={inicial}
          onFechar={() => setModal(null)}
        />
      )}
      {modal === 'arquivar' && (
        <ModalArquivar pacienteId={pacienteId} nome={inicial.nome} onFechar={() => setModal(null)} />
      )}
      {modal === 'reativar' && (
        <ModalReativar pacienteId={pacienteId} nome={inicial.nome} onFechar={() => setModal(null)} />
      )}
      {modal === 'excluir' && (
        <ModalExcluir
          pacienteId={pacienteId}
          nome={inicial.nome}
          totalSessoes={totalSessoes}
          onFechar={() => setModal(null)}
        />
      )}
    </>
  )
}

function ItemMenu({ icone, label, onClick, vermelho }: {
  icone: string; label: string; onClick: () => void; vermelho?: boolean
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 14px', background: 'transparent', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        color: vermelho ? 'var(--rose)' : 'var(--ink-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'background .15s var(--ease)',
        borderTop: '1px solid var(--border)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ width: 16, textAlign: 'center', color: vermelho ? 'var(--rose)' : 'var(--muted)' }}>{icone}</span>
      {label}
    </button>
  )
}

// ─── Modal genérico ─────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
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
        {children}
      </div>
    </div>
  )
}

function CabecalhoModal({ titulo, onClose }: { titulo: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: 0 }}>{titulo}</h3>
      <button
        type="button" onClick={onClose}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 0 }}
        title="Fechar"
      >×</button>
    </div>
  )
}

// ─── Editar ─────────────────────────────────────────────────────────

function ModalEditar({ pacienteId, inicial, onFechar }: {
  pacienteId: string
  inicial: Props['inicial']
  onFechar: () => void
}) {
  const router = useRouter()
  const [nome, setNome] = useState(inicial.nome)
  const [telefone, setTelefone] = useState(inicial.telefone)
  const [email, setEmail] = useState(inicial.email ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setErroCampo(null)
    const r = await atualizarPacienteAction(pacienteId, { nome, telefone, email: email || null })
    setSalvando(false)
    if (r.ok) {
      router.refresh()
      onFechar()
    } else {
      setErro(r.error); setErroCampo(r.campo ?? null)
    }
  }

  return (
    <Backdrop onClose={() => !salvando && onFechar()}>
      <CabecalhoModal titulo="Editar paciente" onClose={onFechar} />

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <Campo label="Nome completo" erro={erroCampo === 'nome' ? erro : null}>
          <input value={nome} onChange={e => setNome(e.target.value)} required autoComplete="name" />
        </Campo>
        <Campo label="Telefone (WhatsApp)" erro={erroCampo === 'telefone' ? erro : null}>
          <input
            value={telefone}
            onChange={e => setTelefone(e.target.value.replace(/[^\d() -]/g, ''))}
            inputMode="tel" required
            placeholder="(11) 91234-5678"
          />
        </Campo>
        <Campo label="Email (opcional)" erro={erroCampo === 'email' ? erro : null}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="email" placeholder="paciente@email.com"
          />
        </Campo>

        {erro && !erroCampo && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        <style jsx>{`
          input {
            width: 100%; padding: 10px 14px; border-radius: 10px;
            border: 1px solid var(--border); background: white;
            font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          }
          input:focus { border-color: var(--accent); }
        `}</style>
      </form>
    </Backdrop>
  )
}

// ─── Arquivar / Reativar ────────────────────────────────────────────

function ModalArquivar({ pacienteId, nome, onFechar }: { pacienteId: string; nome: string; onFechar: () => void }) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    setSalvando(true)
    const r = await arquivarPacienteAction(pacienteId)
    setSalvando(false)
    if (r.ok) { router.refresh(); onFechar() }
  }

  return (
    <Backdrop onClose={onFechar}>
      <CabecalhoModal titulo="Arquivar paciente" onClose={onFechar} />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 18px' }}>
        <strong>{nome}</strong> ficará marcado como inativo e some dos atalhos do dia-a-dia.
        Todo o histórico clínico (sessões, objetivos, marcos) <strong>permanece preservado</strong>
        conforme a guarda mínima de 5 anos exigida pelo CFP 06/2019.
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 20px' }}>
        Você pode reativar a qualquer momento.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn primary" onClick={confirmar} disabled={salvando}>
          {salvando ? '…' : 'Arquivar'}
        </button>
      </div>
    </Backdrop>
  )
}

function ModalReativar({ pacienteId, nome, onFechar }: { pacienteId: string; nome: string; onFechar: () => void }) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)

  async function confirmar() {
    setSalvando(true)
    const r = await reativarPacienteAction(pacienteId)
    setSalvando(false)
    if (r.ok) { router.refresh(); onFechar() }
  }

  return (
    <Backdrop onClose={onFechar}>
      <CabecalhoModal titulo="Reativar paciente" onClose={onFechar} />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 20px' }}>
        <strong>{nome}</strong> voltará a aparecer nas listas e atalhos. Pode agendar novas sessões normalmente.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn primary" onClick={confirmar} disabled={salvando}>
          {salvando ? '…' : 'Reativar'}
        </button>
      </div>
    </Backdrop>
  )
}

// ─── Excluir definitivamente ────────────────────────────────────────

function ModalExcluir({ pacienteId, nome, totalSessoes, onFechar }: {
  pacienteId: string; nome: string; totalSessoes: number; onFechar: () => void
}) {
  const router = useRouter()
  const [confirmTxt, setConfirmTxt] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const bloqueado = totalSessoes > 0
  const podeExcluir = !bloqueado && confirmTxt.trim().toLowerCase() === 'excluir'

  async function confirmar() {
    if (!podeExcluir) return
    setSalvando(true); setErro(null)
    const r = await excluirPacienteAction(pacienteId)
    setSalvando(false)
    if (r.ok) {
      onFechar()
      router.push('/pacientes')
    } else {
      setErro(r.error)
    }
  }

  return (
    <Backdrop onClose={() => !salvando && onFechar()}>
      <CabecalhoModal titulo="Excluir definitivamente" onClose={onFechar} />

      {bloqueado ? (
        <>
          <div style={{
            padding: 14, borderRadius: 8,
            background: 'rgba(196,96,122,.08)',
            border: '1px solid rgba(196,96,122,.25)',
            fontSize: 13, color: '#823045', lineHeight: 1.55, marginBottom: 14,
          }}>
            <strong>{nome}</strong> tem <strong>{totalSessoes} {totalSessoes === 1 ? 'sessão registrada' : 'sessões registradas'}</strong>.
            Por isso a exclusão definitiva está bloqueada — o prontuário deve ser preservado
            por no mínimo 5 anos (Resolução CFP 06/2019).
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 18px' }}>
            Use a opção <strong>Arquivar</strong> em vez disso. O paciente some das listas
            mas o histórico clínico fica armazenado e cifrado.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn primary" onClick={onFechar}>Entendi</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
            <strong>{nome}</strong> não tem sessões registradas. A exclusão é definitiva e remove
            objetivos, anotações de condições e dados de contato. <strong>Não pode ser desfeita.</strong>
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Pra confirmar, digite <strong>excluir</strong> abaixo:
          </p>
          <input
            value={confirmTxt}
            onChange={e => setConfirmTxt(e.target.value)}
            placeholder="excluir"
            autoFocus
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1px solid ${podeExcluir ? 'var(--rose)' : 'var(--border)'}`,
              background: 'white', fontSize: 13, fontFamily: 'inherit',
              color: 'var(--ink)', outline: 'none', marginBottom: 14,
            }}
          />
          {erro && <div style={{ color: 'var(--rose)', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!podeExcluir || salvando}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none',
                cursor: podeExcluir ? 'pointer' : 'not-allowed',
                background: podeExcluir ? 'var(--rose)' : 'var(--surface)',
                color: podeExcluir ? 'white' : 'var(--muted)',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              }}
            >
              {salvando ? '…' : 'Excluir definitivamente'}
            </button>
          </div>
        </>
      )}
    </Backdrop>
  )
}

function Campo({ label, erro, children }: { label: string; erro?: string | null; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {erro && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{erro}</span>}
    </label>
  )
}
