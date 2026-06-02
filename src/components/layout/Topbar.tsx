'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { NAV, mundoFromPath } from '@/lib/nav'

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

const SEEN_KEY = 'auren.notifs.seen'

function readSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch { return new Set() }
}
function writeSeen(s: Set<string>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s))) } catch { /* */ }
}

export function Topbar({ initialSessaoAtiva, initialPendencias }: Props) {
  const pathname = usePathname() ?? '/'
  const mundo = mundoFromPath(pathname)
  const crumb = breadcrumbFor(pathname)

  const [sessaoAtiva, setSessaoAtiva] = useState(initialSessaoAtiva ?? null)
  const [pendencias, setPendencias] = useState<Pendencia[]>(initialPendencias ?? [])
  const [bellOpen, setBellOpen] = useState(false)

  // IDs já vistos (após abrir o popover) — persiste em localStorage
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  useEffect(() => { setSeenIds(readSeen()) }, [])

  // Limpa do "seen" IDs que não estão mais em pendencias (já resolvidos)
  useEffect(() => {
    const ativeIds = new Set(pendencias.map(p => p.id))
    let changed = false
    const cleaned = new Set<string>()
    seenIds.forEach(id => {
      if (ativeIds.has(id)) cleaned.add(id)
      else changed = true
    })
    if (changed) { setSeenIds(cleaned); writeSeen(cleaned) }
  }, [pendencias])  // eslint-disable-line react-hooks/exhaustive-deps

  // Pendências NÃO-vistas (novas desde a última abertura do popover)
  const unseen = useMemo(
    () => pendencias.filter(p => !seenIds.has(p.id)),
    [pendencias, seenIds],
  )

  // Animação do sino — pula quando psicóloga entra (mount com unseen > 0)
  // OU quando chega uma nova pendência durante a navegação.
  // Inicializa em 0 propositalmente pra disparar o shake no primeiro render.
  const prevUnseenCount = useRef(0)
  const [bellShake, setBellShake] = useState(false)
  useEffect(() => {
    if (unseen.length > prevUnseenCount.current) {
      setBellShake(true)
      const t = setTimeout(() => setBellShake(false), 1400)
      prevUnseenCount.current = unseen.length
      return () => clearTimeout(t)
    }
    prevUnseenCount.current = unseen.length
  }, [unseen.length])

  // Marca todas como vistas ao abrir o popover
  function openBell() {
    setBellOpen(true)
    const next = new Set(seenIds)
    pendencias.forEach(p => next.add(p.id))
    setSeenIds(next); writeSeen(next)
  }

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
        <div className="tp-crumb">
          <strong>{crumb.label}</strong>
          {crumb.sub && <span style={{ marginLeft: 8, color: 'var(--faint)' }}>· {crumb.sub}</span>}
        </div>
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
            className={`btn-ico${unseen.length > 0 ? ' has-unread' : ''}${bellShake ? ' is-shaking' : ''}`}
            onClick={() => bellOpen ? setBellOpen(false) : openBell()}
            title={unseen.length > 0 ? `${unseen.length} novas notificações` : 'Notificações'}
            aria-label="Notificações"
          >
            <Bell size={16} />
            {unseen.length > 0 && (
              <span className="bell-badge" aria-hidden="true">
                {unseen.length > 9 ? '9+' : unseen.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <NotificationsPopover
              pendencias={pendencias}
              unseenIds={new Set(unseen.map(p => p.id))}
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

function NotificationsPopover({ pendencias, unseenIds, onClose }: { pendencias: Pendencia[]; unseenIds: Set<string>; onClose: () => void }) {
  return (
    <>
      {/* clicar fora fecha */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
      <div className="card" style={{
        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
        width: 340, padding: 0, zIndex: 81, maxHeight: 460, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="card-h" style={{ padding: '12px 16px' }}>
          <span className="card-title">Notificações</span>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar"><X size={14} /></button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 380 }}>
          {pendencias.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              ✓ Tudo em dia.
            </div>
          ) : (
            pendencias.map(p => {
              const isNew = unseenIds.has(p.id)
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  onClick={onClose}
                  className={`pend-row in-popover${isNew ? ' is-new' : ''}`}
                >
                  {isNew && <span className="pend-dot" aria-hidden="true" />}
                  <span className="pend-ico">{PEND_ICON[p.tipo]}</span>
                  <span className="pend-lbl">{p.label}</span>
                  {isNew && <span className="pend-new-tag">Nova</span>}
                  <span className="pend-act">→</span>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

function breadcrumbFor(pathname: string): { label: string; sub?: string } {
  if (pathname === '/' || pathname === '') return { label: 'Início' }
  if (pathname.startsWith('/login')) return { label: 'Entrar' }
  if (pathname.startsWith('/sessao/')) return { label: 'Sessão', sub: 'modo presença' }
  if (pathname.startsWith('/pacientes/') && pathname.endsWith('/objetivos')) return { label: 'Objetivos', sub: 'paciente' }
  if (pathname.startsWith('/pacientes/') && pathname.endsWith('/temas'))     return { label: 'Temas Recorrentes', sub: 'paciente' }
  if (pathname.startsWith('/pacientes/') && pathname.endsWith('/evolucao'))  return { label: 'Evolução Registrada', sub: 'paciente' }
  if (pathname === '/pacientes/novo') return { label: 'Novo paciente' }
  if (pathname.startsWith('/pacientes/')) return { label: 'Perfil', sub: 'paciente' }
  if (pathname === '/pacientes') return { label: 'Pacientes' }
  if (pathname === '/agenda/nova') return { label: 'Nova sessão' }
  if (pathname === '/agenda') return { label: 'Agenda' }
  if (pathname === '/financeiro') return { label: 'Financeiro' }
  if (pathname === '/saude') return { label: 'Saúde da Prática' }
  const hit = NAV.find(n => n.href === pathname)
  if (hit) return { label: hit.label }
  return { label: 'Auren Care' }
}
