'use client'

import { useEffect, useRef, useState } from 'react'

type Mensagem = { role: 'user' | 'assistant'; content: string }
type Sugestao = { label: string; prompt: string }
type Salvo = { id: string; titulo: string; updatedAt: string }

/**
 * Chat IA pra redigir prontuário em linguagem natural.
 *
 * Princípio CFP 09/2024 reforçado no banner permanente: rascunho, revisão
 * obrigatória, IA não diagnostica.
 *
 * Salva conversas no histórico (texto vigente + mensagens), permite
 * reabrir e continuar refinando depois.
 */
export function ProntuarioIaChat({ pacienteId }: { pacienteId: string }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [salvos, setSalvos]       = useState<Salvo[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [entrada, setEntrada] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [titulo, setTitulo] = useState('Prontuário psicológico — narrativa')
  const [feedback, setFeedback] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Carrega sugestões + histórico
  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/prontuario/chat`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setSugestoes(j?.sugestoes ?? []))
      .catch(() => {})
    recarregarSalvos()
  }, [pacienteId])

  function recarregarSalvos() {
    fetch(`/api/pacientes/${pacienteId}/prontuario/ia-historico`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setSalvos(j?.prontuarios ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mensagens, pensando])

  // Limpa feedback após 3s
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(t)
  }, [feedback])

  // Última resposta do assistente = "texto vigente"
  const textoVigente = (() => {
    for (let i = mensagens.length - 1; i >= 0; i--) {
      if (mensagens[i].role === 'assistant') return mensagens[i].content
    }
    return ''
  })()

  async function enviar(textoUsuario: string) {
    if (!textoUsuario.trim() || pensando) return
    setErro(null)
    const proximas: Mensagem[] = [...mensagens, { role: 'user', content: textoUsuario.trim() }]
    setMensagens(proximas)
    setEntrada('')
    setPensando(true)

    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: proximas }),
      })
      const j = await r.json()
      if (!r.ok || !j.resposta) {
        setErro(j?.error === 'internal' ? 'Falha ao gerar agora. Tente novamente.' : 'Não consegui responder.')
        setMensagens(prev => prev.slice(0, -1))
      } else {
        setMensagens(prev => [...prev, { role: 'assistant', content: j.resposta }])
      }
    } catch {
      setErro('Sem conexão.')
      setMensagens(prev => prev.slice(0, -1))
    } finally {
      setPensando(false)
    }
  }

  async function exportarPdf() {
    if (!textoVigente.trim()) return
    setGerandoPdf(true)
    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/ia-pdf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoVigente, titulo }),
      })
      if (!r.ok) { setErro('Falha ao gerar PDF.'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `prontuario-narrativa.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Falha ao gerar PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  async function salvar() {
    if (!textoVigente.trim()) return
    setSalvando(true); setErro(null)
    try {
      if (editandoId) {
        // Atualiza
        const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/ia-historico/${editandoId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo, texto: textoVigente, mensagens }),
        })
        if (!r.ok) { setErro('Não foi possível atualizar.'); return }
        setFeedback('✓ Atualizado')
      } else {
        // Cria
        const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/ia-historico`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo, texto: textoVigente, mensagens }),
        })
        const j = await r.json()
        if (!r.ok || !j?.id) { setErro('Não foi possível salvar.'); return }
        setEditandoId(j.id)
        setFeedback('✓ Salvo no histórico')
      }
      recarregarSalvos()
    } catch {
      setErro('Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function carregar(hid: string) {
    if (mensagens.length > 0 && !confirm('Descartar a conversa atual e carregar este prontuário salvo?')) return
    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/ia-historico/${hid}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j?.prontuario) { setErro('Não consegui abrir o prontuário salvo.'); return }
      const p = j.prontuario as { id: string; titulo: string; texto: string; mensagens: Mensagem[] }
      setMensagens(p.mensagens.length > 0
        ? p.mensagens
        // se o histórico de chat foi perdido, sintetiza a partir do texto
        : [{ role: 'assistant', content: p.texto }])
      setTitulo(p.titulo)
      setEditandoId(p.id)
      setFeedback('Carregado do histórico')
    } catch {
      setErro('Falha ao carregar.')
    }
  }

  async function deletar(hid: string, tituloAlvo: string) {
    if (!confirm(`Excluir definitivamente "${tituloAlvo}"?`)) return
    try {
      const r = await fetch(`/api/pacientes/${pacienteId}/prontuario/ia-historico/${hid}`, { method: 'DELETE' })
      if (!r.ok) { setErro('Não foi possível excluir.'); return }
      if (editandoId === hid) {
        setEditandoId(null)
        setMensagens([])
      }
      recarregarSalvos()
      setFeedback('✓ Excluído')
    } catch {
      setErro('Falha ao excluir.')
    }
  }

  function novo() {
    if (mensagens.length > 0 && !confirm('Descartar conversa atual?')) return
    setMensagens([])
    setEditandoId(null)
    setTitulo('Prontuário psicológico — narrativa')
    setErro(null)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Banner CFP */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(176,125,64,.08)', border: '1px solid rgba(176,125,64,.22)',
      }}>
        <span style={{ fontSize: 14 }}>🧭</span>
        <div style={{ fontSize: 11, color: '#7a5520', lineHeight: 1.55 }}>
          <strong>IA assistente · CFP 09/2024 · LGPD.</strong> O texto gerado é rascunho.
          Revise antes de assinar. A IA usa contexto clínico já registrado — nada é treinado.
        </div>
      </div>

      {/* Histórico — sempre visível pra deixar óbvio que existe */}
      <HistoricoBar
        salvos={salvos}
        editandoId={editandoId}
        onCarregar={carregar}
        onDeletar={deletar}
        onNovo={novo}
      />

      {/* Mensagens */}
      <div
        ref={scrollRef}
        style={{
          height: 320, overflowY: 'auto',
          padding: 14, borderRadius: 10,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}
      >
        {mensagens.length === 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
              Comece com uma sugestão ou descreva o que precisa redigir.
              Você pode pedir refinamentos depois (&quot;mais sucinto&quot;, &quot;destaca o objetivo X&quot;).
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {sugestoes.map((s, i) => (
                <button
                  key={i} type="button"
                  onClick={() => enviar(s.prompt)}
                  disabled={pensando}
                  style={{
                    textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    color: 'var(--ink-soft)',
                    transition: 'background .15s var(--ease)',
                  }}
                >
                  <strong style={{ color: 'var(--accent)' }}>›</strong> {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {mensagens.map((m, i) => <Bolha key={i} m={m} />)}
            {pensando && <Pensando />}
          </div>
        )}
      </div>

      {feedback && (
        <div style={{
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(90,158,138,.10)', color: 'var(--sage)',
          fontSize: 12, textAlign: 'center',
        }}>{feedback}</div>
      )}

      {erro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); enviar(entrada) }}
        style={{ display: 'flex', gap: 8 }}
      >
        <textarea
          value={entrada}
          onChange={e => setEntrada(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              enviar(entrada)
            }
          }}
          placeholder={mensagens.length === 0
            ? 'Ex: gere um resumo do tratamento até hoje em 2 parágrafos…'
            : 'Peça refinamento ou novo trecho. Enter envia, Shift+Enter quebra linha.'}
          rows={2}
          disabled={pensando}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'white',
            fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
            outline: 'none', resize: 'vertical', lineHeight: 1.55, minHeight: 44,
          }}
        />
        <button
          type="submit"
          disabled={pensando || !entrada.trim()}
          className="btn primary"
          style={{ alignSelf: 'flex-end', padding: '10px 18px' }}
        >
          {pensando ? '…' : 'Enviar'}
        </button>
      </form>

      {/* Footer: título + ações */}
      {textoVigente && (
        <div style={{
          display: 'grid', gap: 10,
          padding: 14, borderRadius: 10,
          background: 'rgba(106,78,200,.05)', border: '1px solid rgba(106,78,200,.20)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {editandoId ? 'Editando prontuário salvo' : 'Texto vigente'}
            </span>
            {editandoId && (
              <button
                type="button" onClick={novo}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 11, padding: 0,
                }}
              >
                + criar novo
              </button>
            )}
          </div>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Título</span>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'white',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button" className="btn ghost"
              onClick={salvar}
              disabled={salvando || gerandoPdf}
            >
              {salvando ? 'Salvando…' : editandoId ? '💾 Atualizar' : '💾 Salvar no histórico'}
            </button>
            <button
              type="button" className="btn primary"
              onClick={exportarPdf}
              disabled={gerandoPdf || salvando}
            >
              {gerandoPdf ? 'Gerando…' : '⤓ Exportar como PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Histórico bar ─────────────────────────────────────────────────

function HistoricoBar({
  salvos, editandoId, onCarregar, onDeletar, onNovo,
}: {
  salvos: Salvo[]
  editandoId: string | null
  onCarregar: (hid: string) => void
  onDeletar: (hid: string, titulo: string) => void
  onNovo: () => void
}) {
  const [aberto, setAberto] = useState(false)

  if (salvos.length === 0) {
    return (
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: 'var(--surface)', border: '1px solid var(--border)',
        fontSize: 11, color: 'var(--faint)', textAlign: 'center',
      }}>
        Nenhum prontuário IA salvo ainda. Salve este pra retomar depois.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '8px 12px',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, color: 'var(--ink-soft)',
        }}
      >
        <span>
          📁 <strong>{salvos.length}</strong> {salvos.length === 1 ? 'prontuário salvo' : 'prontuários salvos'}
          {editandoId && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· editando</span>}
        </span>
        <span style={{ color: 'var(--muted)' }}>{aberto ? '▴' : '▾'}</span>
      </button>

      {aberto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          marginTop: 4, zIndex: 10,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(26,24,37,.10)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {editandoId !== null && (
            <button
              type="button"
              onClick={() => { onNovo(); setAberto(false) }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              + Criar novo prontuário
            </button>
          )}
          {salvos.map(p => (
            <div
              key={p.id}
              style={{
                display: 'flex', gap: 8,
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                background: editandoId === p.id ? 'rgba(106,78,200,.06)' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => { onCarregar(p.id); setAberto(false) }}
                style={{
                  flex: 1, textAlign: 'left',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', padding: 0,
                }}
              >
                <div style={{
                  fontSize: 13, color: 'var(--ink)',
                  fontWeight: editandoId === p.id ? 600 : 500,
                  marginBottom: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.titulo}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  atualizado {formatData(p.updatedAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDeletar(p.id, p.titulo)}
                title="Excluir"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--rose)', fontSize: 14, padding: '0 4px',
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatData(iso: string): string {
  try {
    const d = new Date(iso)
    const hoje = new Date()
    if (d.toDateString() === hoje.toDateString()) {
      return `hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

function Bolha({ m }: { m: Mensagem }) {
  const ehUsuario = m.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: ehUsuario ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%', padding: '10px 14px', borderRadius: 10,
        background: ehUsuario ? 'rgba(106,78,200,.10)' : 'var(--card)',
        border: ehUsuario ? '1px solid rgba(106,78,200,.25)' : '1px solid var(--border)',
        fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {m.content}
      </div>
    </div>
  )
}

function Pensando() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: 'var(--card)', border: '1px solid var(--border)',
        fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6,
      }}>
        <span style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>•</span>
        <span style={{ animation: 'pulse 1.4s ease-in-out infinite .2s' }}>•</span>
        <span style={{ animation: 'pulse 1.4s ease-in-out infinite .4s' }}>•</span>
        <style jsx>{`
          @keyframes pulse { 0%, 80%, 100% { opacity: .3 } 40% { opacity: 1 } }
        `}</style>
      </div>
    </div>
  )
}
