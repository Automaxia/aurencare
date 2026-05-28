'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { NAV, mundoFromPath, activeHref } from '@/lib/nav'

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

export function Topbar({ initialSessaoAtiva, initialPendencias }: Props) {
  const pathname = usePathname() ?? '/'
  const mundo = mundoFromPath(pathname)
  const crumb = breadcrumbFor(pathname)

  const [sessaoAtiva, setSessaoAtiva] = useState(initialSessaoAtiva ?? null)
  const [pendencias, setPendencias] = useState<Pendencia[]>(initialPendencias ?? [])
  const [bellOpen, setBellOpen] = useState(false)

  // Atualiza ao receber eventos do SSE — sessão começa/encerra ou pagamento confirma
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
          data.type === 'pagamento.recebido'
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
        {/* Sessão ativa */}
        {sessaoAtiva && (
          <Link href={`/sessao/${sessaoAtiva.id}`} className="sess-pill" title="Voltar para a sessão em andamento">
            <span className="rp" />
            <span>{sessaoAtiva.pacienteNome} · em andamento</span>
          </Link>
        )}

        {/* Notificações */}
        <div style={{ position: 'relative' }}>
          <button className="btn-ico" onClick={() => setBellOpen(o => !o)} title="Notificações" aria-label="Notificações">
            <Bell size={16} />
            {pendencias.length > 0 && (
              <span style={{
                position: 'absolute', top: 7, right: 7,
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--amber)', border: '1.5px solid var(--page)',
              }} />
            )}
          </button>
          {bellOpen && (
            <NotificationsPopover pendencias={pendencias} onClose={() => setBellOpen(false)} />
          )}
        </div>

        {/* Agenda atalho */}
        <Link href="/agenda" className="btn ghost sm">Agenda</Link>

        {/* Nova sessão */}
        <Link href="/agenda/nova" className="btn primary sm">+ Sessão</Link>

        {/* Pill de contexto (mantida — mais compacta agora à direita) */}
        <span className="ctx-pill" data-world={mundo} style={{ marginLeft: 4 }} title={mundo === 'clinico' ? 'Mundo clínico' : 'Mundo prática'}>
          <span className="ctx-dot" />
        </span>
      </div>
    </header>
  )
}

function NotificationsPopover({ pendencias, onClose }: { pendencias: Pendencia[]; onClose: () => void }) {
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
            pendencias.map(p => (
              <Link key={p.id} href={p.href} onClick={onClose} className="pend-row" style={{ padding: '12px 16px', borderRadius: 0 }}>
                <span className="pend-ico">{PEND_ICON[p.tipo]}</span>
                <span className="pend-lbl">{p.label}</span>
                <span className="pend-act">→</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}

function breadcrumbFor(pathname: string): { label: string; sub?: string } {
  // Especiais primeiro
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
  // Fallback: tenta match com NAV
  const hit = NAV.find(n => n.href === pathname)
  if (hit) return { label: hit.label }
  return { label: 'Auren Care' }
}
