'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { mundoFromPath } from '@/lib/nav'
import { buildBreadcrumb } from '@/lib/breadcrumb'

type SessaoAtiva = { id: string; pacienteNome: string; numero: number; iniciadaEm: string | null }
type Pendencia = { id: string; tipo: 'registrar' | 'cobranca' | 'consentimento'; label: string; href: string; data?: string }

type Props = {
  initialSessaoAtiva: SessaoAtiva | null
  initialPendencias: Pendencia[]
}

const PEND_ICON: Record<Pendencia['tipo'], string> = {
  registrar: '📝',
  cobranca:  '💳',
  consentimento: '✋',
}

// Chave nova (v2): invalida o "lixo" do modelo antigo de "visto".
const READ_KEY = 'audere.notifs.read'

function readReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch { return new Set() }
}
function writeReadIds(s: Set<string>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(s))) } catch { /* */ }
}

export function Topbar({ initialSessaoAtiva, initialPendencias }: Props) {
  const pathname = usePathname() ?? '/'
  const mundo = mundoFromPath(pathname)

  const [sessaoAtiva, setSessaoAtiva] = useState(initialSessaoAtiva ?? null)
  const [pendencias, setPendencias] = useState<Pendencia[]>(initialPendencias ?? [])
  const [bellOpen, setBellOpen] = useState(false)

  // Nome do paciente para a trilha (subpáginas de /pacientes/[id]). Cache por id
  // pra não re-buscar ao navegar entre as abas do mesmo paciente.
  const [pacienteNome, setPacienteNome] = useState<string | null>(null)
  const pacCache = useRef<Record<string, string>>({})
  useEffect(() => {
    const id = pathname.match(/^\/pacientes\/([^/]+)/)?.[1]
    if (!id || id === 'novo') { setPacienteNome(null); return }
    if (pacCache.current[id]) { setPacienteNome(pacCache.current[id]); return }
    let cancel = false
    fetch(`/api/pacientes/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancel && j?.nome) { pacCache.current[id] = j.nome; setPacienteNome(j.nome) } })
      .catch(() => {})
    return () => { cancel = true }
  }, [pathname])

  const crumbs = buildBreadcrumb(pathname, { pacienteNome })

  // IDs marcados como LIDOS — persiste em localStorage. Diferente do modelo
  // antigo: abrir o sino NÃO marca tudo como lido; o usuário marca explicitamente
  // (por item ou "marcar todas"). Assim a distinção lida/não-lida não some.
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  useEffect(() => { setReadIds(readReadIds()) }, [])

  // Poda IDs lidos que não estão mais em pendencias (resolvidos) — evita o
  // localStorage acumular "lixo".
  useEffect(() => {
    setReadIds(prev => {
      const ativos = new Set(pendencias.map(p => p.id))
      const cleaned = new Set([...prev].filter(id => ativos.has(id)))
      if (cleaned.size !== prev.size) { writeReadIds(cleaned); return cleaned }
      return prev
    })
  }, [pendencias])

  // Pendências NÃO-lidas
  const unread = useMemo(
    () => pendencias.filter(p => !readIds.has(p.id)),
    [pendencias, readIds],
  )

  // Animação do sino — pula quando o nº de não-lidas AUMENTA (nova pendência).
  const prevUnreadCount = useRef(0)
  const [bellShake, setBellShake] = useState(false)
  useEffect(() => {
    if (unread.length > prevUnreadCount.current) {
      setBellShake(true)
      const t = setTimeout(() => setBellShake(false), 1400)
      prevUnreadCount.current = unread.length
      return () => clearTimeout(t)
    }
    prevUnreadCount.current = unread.length
  }, [unread.length])

  function marcarLida(id: string) {
    setReadIds(prev => { const next = new Set(prev); next.add(id); writeReadIds(next); return next })
  }
  function marcarTodasLidas() {
    const next = new Set(pendencias.map(p => p.id))
    setReadIds(next); writeReadIds(next)
  }

  // Re-sincroniza com o estado real do banco a cada navegação. Necessário porque
  // o estado vive em useState (não acompanha props novas) e o Next pode servir a
  // rota do cache: ao voltar de uma sessão encerrada, o pill "em andamento" ficava
  // preso até o refresh. Aqui ele se auto-cura em qualquer troca de rota.
  useEffect(() => {
    let cancel = false
    fetch('/api/atalhos')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancel || !j) return
        setSessaoAtiva(j.sessaoAtiva ?? null)
        setPendencias(j.pendencias ?? [])
      })
      .catch(() => {})
    return () => { cancel = true }
  }, [pathname])

  // Atualiza ao receber eventos do SSE
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
    const es = new EventSource('/api/eventos')

    es.onmessage = async (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (
          data.type === 'sessao.iniciada' ||
          data.type === 'sessao.encerrada' ||
          data.type === 'sessao.confirmada' ||
          data.type === 'pagamento.recebido' ||
          data.type === 'paciente.consentiu'
        ) {
          const res = await fetch('/api/atalhos')
          if (res.ok) {
            const json = await res.json()
            setSessaoAtiva(json.sessaoAtiva ?? null)
            setPendencias(json.pendencias ?? [])
          }
        }
      } catch { /* */ }
    }

    es.onerror = () => { /* silencioso — reconnects automaticamente */ }
    return () => es.close()
  }, [])

  return (
    <header className="topbar">
      <div className="tp-l">
        <nav className="bc" aria-label="Trilha de navegação">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <span key={`${c.label}-${i}`} className="bc-seg">
                {i > 0 && <span className="bc-sep" aria-hidden="true">›</span>}
                {c.href && !last
                  ? <Link href={c.href} className="bc-link">{c.label}</Link>
                  : <span className={last ? 'bc-current' : 'bc-link'} aria-current={last ? 'page' : undefined}>{c.label}</span>}
              </span>
            )
          })}
        </nav>
      </div>

      <div className="tp-r">
        {/* Sessão ativa — pill aceso/destacado durante a sessão */}
        {sessaoAtiva && (
          <Link
            href={`/sessao/${sessaoAtiva.id}`}
            className="sess-pill is-live"
            title="Voltar para a sessão em andamento"
          >
            <span className="rp" />
            <span>{sessaoAtiva.pacienteNome} · em andamento</span>
          </Link>
        )}

        {/* Notificações */}
        <div style={{ position: 'relative' }}>
          <button
            className={`btn-ico${unread.length > 0 ? ' has-unread' : ''}${bellShake ? ' is-shaking' : ''}`}
            onClick={() => setBellOpen(o => !o)}
            title={unread.length > 0 ? `${unread.length} notificações não lidas` : 'Notificações'}
            aria-label="Notificações"
          >
            <Bell size={16} />
            {unread.length > 0 && (
              <span className="bell-badge" aria-hidden="true">
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <NotificationsPopover
              pendencias={pendencias}
              readIds={readIds}
              onMarcarLida={marcarLida}
              onMarcarTodas={marcarTodasLidas}
              onClose={() => setBellOpen(false)}
            />
          )}
        </div>

        {/* Agenda atalho */}
        <Link href="/agenda" className="btn ghost sm">Agenda</Link>

        {/* Nova sessão */}
        <Link href="/agenda/nova" className="btn primary sm">+ Sessão</Link>

        {/* Pill de contexto (compacto) */}
        <span className="ctx-pill" data-world={mundo} style={{ marginLeft: 4 }} title={mundo === 'clinico' ? 'Mundo clínico' : 'Mundo prática'}>
          <span className="ctx-dot" />
        </span>
      </div>
    </header>
  )
}

function NotificationsPopover({ pendencias, readIds, onMarcarLida, onMarcarTodas, onClose }: {
  pendencias: Pendencia[]
  readIds: Set<string>
  onMarcarLida: (id: string) => void
  onMarcarTodas: () => void
  onClose: () => void
}) {
  const naoLidas = pendencias.filter(p => !readIds.has(p.id)).length
  // Não-lidas primeiro, depois as lidas.
  const ordenadas = [...pendencias].sort(
    (a, b) => (readIds.has(a.id) ? 1 : 0) - (readIds.has(b.id) ? 1 : 0),
  )

  return (
    <>
      {/* clicar fora fecha */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
      <div className="card" style={{
        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
        width: 360, padding: 0, zIndex: 81, maxHeight: 460, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="card-h" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="card-title">
            Notificações
            {naoLidas > 0 && <span style={{ color: 'var(--amber)', fontWeight: 500 }}> · {naoLidas} não lida{naoLidas > 1 ? 's' : ''}</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {naoLidas > 0 && (
              <button className="btn ghost sm" onClick={onMarcarTodas} title="Marcar todas como lidas">
                Marcar todas
              </button>
            )}
            <button className="btn ghost sm" onClick={onClose} aria-label="Fechar"><X size={14} /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 380 }}>
          {pendencias.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              ✓ Tudo em dia.
            </div>
          ) : (
            ordenadas.map(p => {
              const naoLida = !readIds.has(p.id)
              return (
                <div key={p.id} className={`pend-row in-popover${naoLida ? ' is-new' : ''}`}>
                  {naoLida && <span className="pend-dot" aria-hidden="true" />}
                  <Link
                    href={p.href}
                    onClick={() => { onMarcarLida(p.id); onClose() }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <span className="pend-ico">{PEND_ICON[p.tipo]}</span>
                    <span className="pend-lbl">{p.label}</span>
                  </Link>
                  {naoLida
                    ? (
                      <button
                        className="pend-check"
                        title="Marcar como lida"
                        aria-label="Marcar como lida"
                        onClick={(e) => { e.stopPropagation(); onMarcarLida(p.id) }}
                      >✓</button>
                    )
                    : <span className="pend-read-tag">lida</span>}
                </div>
              )
            })
          )}
        </div>
        {pendencias.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>
            As pendências ficam aqui até serem <strong>resolvidas</strong> (ex.: abrir a sessão e <strong>assinar o registro</strong>). “Marcar como lida” só silencia o aviso — não resolve.
          </div>
        )}
      </div>
    </>
  )
}

