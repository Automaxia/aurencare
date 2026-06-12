'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarPacienteDemoAction, removerPacienteDemoAction } from './demo-actions'

/**
 * Controle do paciente de demonstração "Maria Joana".
 * - Sem demo: botão que cria (conteúdo gerado por IA) e abre o paciente.
 * - Com demo: botão discreto para remover ela e todos os dados.
 */
export function DemoControl({ demoId, variant = 'header' }: { demoId: string | null; variant?: 'header' | 'empty' }) {
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
    // Já existe: oferecer abrir + remover.
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="btn ghost sm" onClick={remover} disabled={busy} title="Remover paciente de demonstração">
          {busy ? 'Removendo…' : '🗑 Remover demonstração'}
        </button>
      </span>
    )
  }

  const label = busy ? 'Criando demonstração…' : '✨ Paciente de demonstração'
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: variant === 'empty' ? 'center' : 'flex-end', gap: 4 }}>
      <button
        className={variant === 'empty' ? 'btn primary' : 'btn ghost'}
        onClick={criar}
        disabled={busy}
        title="Cria a Maria Joana — paciente fictícia com 6 sessões para testar e apresentar"
      >
        {label}
      </button>
      {erro && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{erro}</span>}
      {busy && <span style={{ fontSize: 11, color: 'var(--faint)' }}>Gerando conteúdo com IA — pode levar alguns segundos.</span>}
    </span>
  )
}
