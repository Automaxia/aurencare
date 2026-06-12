'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { criarPacienteDemoAction, removerPacienteDemoAction } from './demo-actions'

/**
 * Controle do paciente de demonstração "Maria Joana".
 * - Sem demo: botão que cria (conteúdo gerado por IA) e abre o paciente.
 * - Com demo (header): botão discreto para remover ela e todos os dados.
 * - Com demo (onboarding): link para abrir o paciente.
 */
export function DemoControl({ demoId, variant = 'header' }: { demoId: string | null; variant?: 'header' | 'empty' | 'onboarding' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar() {
    setBusy(true); setErro(null)
    const r = await criarPacienteDemoAction()
    setBusy(false)
    if (r.ok) router.push(`/pacientes/${r.id}`)
    else setErro(r.error)
  }

  async function remover() {
    if (!confirm('Remover o paciente de demonstração e todos os dados dele? Esta ação não pode ser desfeita.')) return
    setBusy(true); setErro(null)
    await removerPacienteDemoAction()
    setBusy(false)
    router.refresh()
  }

  if (demoId) {
    // No onboarding, oferecer ABRIR; nas demais áreas, remover.
    if (variant === 'onboarding') {
      return (
        <Link href={`/pacientes/${demoId}`} className="btn ghost sm" style={{ whiteSpace: 'nowrap' }}>
          Abrir Maria Joana →
        </Link>
      )
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="btn ghost sm" onClick={remover} disabled={busy} title="Remover paciente de demonstração">
          {busy ? 'Removendo…' : '🗑 Remover demonstração'}
        </button>
      </span>
    )
  }

  const label = busy ? 'Criando demonstração…' : '✨ Paciente de demonstração'
  const align = variant === 'empty' ? 'center' : variant === 'onboarding' ? 'flex-start' : 'flex-end'
  // Destaque "discreto-mas-com-talento": tinta de accent + sage, borda viva e
  // brilho leve no hover — chama o olho sem competir com o botão primário.
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: variant === 'empty' ? '10px 18px' : '8px 14px',
    fontSize: variant === 'empty' ? 14 : 12.5, fontWeight: 600,
    borderRadius: 10, cursor: busy ? 'default' : 'pointer',
    color: 'var(--accent)',
    border: '1px solid rgba(106,78,200,.32)',
    background: 'linear-gradient(135deg, rgba(106,78,200,.12), rgba(90,158,138,.10))',
    boxShadow: '0 1px 2px rgba(106,78,200,.10)',
    opacity: busy ? .7 : 1,
    transition: 'transform .12s var(--ease), box-shadow .15s var(--ease), background .15s var(--ease)',
    whiteSpace: 'nowrap',
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: align, gap: 4 }}>
      <button
        className="demo-cta"
        style={btnStyle}
        onClick={criar}
        disabled={busy}
        title="Cria a Maria Joana — paciente fictícia com 6 sessões para testar e apresentar"
      >
        {label}
      </button>
      {erro && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{erro}</span>}
      {busy && <span style={{ fontSize: 11, color: 'var(--faint)' }}>Gerando conteúdo com IA — pode levar alguns segundos.</span>}
      <style jsx>{`
        .demo-cta:hover:not(:disabled) {
          transform: translateY(-1px);
          background: linear-gradient(135deg, rgba(106,78,200,.18), rgba(90,158,138,.15));
          box-shadow: 0 3px 10px rgba(106,78,200,.18);
        }
      `}</style>
    </span>
  )
}
