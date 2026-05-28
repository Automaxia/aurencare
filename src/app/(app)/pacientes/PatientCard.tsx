'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type PatientCardData = {
  id: string
  nome: string
  telefone: string
  consentimentoAceito: boolean
  badgeLabel: string | null
  badgeKlass: 'info' | 'ok' | 'warn' | 'alert' | 'mute' | null
  proximaSessao: { id: string; dataHora: string } | null
  proximaTexto: string
  proximaHoje: boolean
  freqLabel: string
  freqKlass: 'ok' | 'warn' | 'mute'
  desdeMes: string
  sessoesTotais: number
  avInitials: string
  avBg: string
  principalCta: { label: string; href: string }
}

export function PatientCard({ p }: { p: PatientCardData }) {
  const router = useRouter()
  const cardHref = `/pacientes/${p.id}`

  // ações internas: stopPropagation pra não cancelar navegação do wrapper
  const stop = (e: React.MouseEvent | React.KeyboardEvent) => { e.stopPropagation() }

  return (
    <div
      className="ptc"
      role="link"
      tabIndex={0}
      onClick={() => router.push(cardHref)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(cardHref) } }}
      title={`Abrir perfil de ${p.nome}`}
    >
      <div className="ptc-b">
        <div className="ptc-head">
          <div className="ptc-id">
            <div className="ptc-av" style={{ background: p.avBg }}>{p.avInitials}</div>
            <div>
              <div className="ptc-name">{p.nome}</div>
              <div className="ptc-meta">
                {p.sessoesTotais > 0
                  ? `desde ${p.desdeMes} · Sessão ${p.sessoesTotais}`
                  : `cadastrado em ${p.desdeMes}`}
              </div>
            </div>
          </div>
          {p.badgeLabel && p.badgeKlass
            ? <span className={`tag t-${p.badgeKlass}`} style={{ fontSize: 10 }}>{p.badgeLabel}</span>
            : p.proximaHoje
              ? <span className="ptc-dot" style={{ background: 'var(--sage)' }} title="Sessão hoje" />
              : null}
        </div>

        <div className="ptc-rows">
          <div className="ptc-row">
            <span className="k">Próxima sessão</span>
            <span className="v">{p.proximaTexto}</span>
          </div>
          <div className="ptc-row">
            <span className="k">Frequência</span>
            <span className={`tag t-${p.freqKlass}`}>{p.freqLabel}</span>
          </div>
          <div className="ptc-row">
            <span className="k">WhatsApp</span>
            <span className={`tag t-${p.consentimentoAceito ? 'ok' : 'warn'}`}>
              {p.consentimentoAceito ? 'Conectado' : 'Pendente'}
            </span>
          </div>
        </div>

        <div className="ptc-actions" onClick={stop} onKeyDown={stop}>
          <Link className="btn sm" href={`/pacientes/${p.id}/evolucao`} onClick={stop}>
            Evolução
          </Link>
          <a
            className="btn sm"
            href={`https://wa.me/55${p.telefone.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            onClick={stop}
          >
            WhatsApp
          </a>
          <Link className="btn primary sm" href={p.principalCta.href} onClick={stop}>
            {p.principalCta.label}
          </Link>
        </div>
      </div>
    </div>
  )
}
