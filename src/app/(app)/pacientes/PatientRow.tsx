'use client'

import Link from 'next/link'
import type { PatientCardData } from './PatientCard'

/**
 * Linha compacta de paciente — alternativa de visualização "Lista".
 * Mesma fonte de dados do PatientCard, layout horizontal denso pra
 * mostrar mais pacientes na tela sem perder o essencial.
 */
export function PatientRow({ p }: { p: PatientCardData }) {
  return (
    <Link
      href={`/pacientes/${p.id}`}
      className="ptr"
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto auto',
        alignItems: 'center', gap: 14,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', textDecoration: 'none', color: 'inherit',
        transition: 'background .15s var(--ease)',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: p.avBg, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, letterSpacing: '.04em',
        }}
      >
        {p.avInitials}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {p.nome}
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
          {p.telefone} · desde {p.desdeMes} · {p.sessoesTotais} sessõe{p.sessoesTotais === 1 ? '' : 's'}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>
          Próxima
        </div>
        <div style={{
          fontSize: 13, color: p.proximaHoje ? 'var(--sage)' : 'var(--ink-soft)',
          fontWeight: p.proximaHoje ? 500 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {p.proximaTexto}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>
          Frequência
        </div>
        <div style={{ fontSize: 13, color: corFreq(p.freqKlass) }}>{p.freqLabel}</div>
      </div>

      <div>
        {p.badgeLabel && <span className={`badge ${badgeAlias(p.badgeKlass)}`}>{p.badgeLabel}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={e => {
            e.preventDefault(); e.stopPropagation()
            window.location.assign(p.principalCta.href)
          }}
          className="btn ghost sm"
          style={{ padding: '5px 12px', whiteSpace: 'nowrap' }}
        >
          {p.principalCta.label}
        </button>
        <span style={{ color: 'var(--faint)', fontSize: 14 }}>›</span>
      </div>
    </Link>
  )
}

function badgeAlias(k: PatientCardData['badgeKlass']) {
  if (k === 'ok')    return 'sage'
  if (k === 'warn')  return 'amber'
  if (k === 'alert') return 'rose'
  if (k === 'info')  return 'info'
  return 'muted'
}
function corFreq(k: 'ok' | 'warn' | 'mute') {
  if (k === 'ok')   return 'var(--ink-soft)'
  if (k === 'warn') return 'var(--rose)'
  return 'var(--faint)'
}
