'use client'

import { useRouter } from 'next/navigation'

export function ViewToggle({ view, ancora }: { view: 'dia' | 'semana' | 'mes'; ancora: string }) {
  const router = useRouter()
  const change = (v: string) => router.push(`/agenda?view=${v}&data=${encodeURIComponent(ancora)}`)
  const nav = (delta: number) => {
    const d = new Date(ancora)
    if (view === 'dia')    d.setDate(d.getDate() + delta)
    if (view === 'semana') d.setDate(d.getDate() + 7 * delta)
    if (view === 'mes')    d.setMonth(d.getMonth() + delta)
    router.push(`/agenda?view=${view}&data=${encodeURIComponent(d.toISOString())}`)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <div className="cal-tabs">
        {(['dia','semana','mes'] as const).map(v => (
          <button key={v} onClick={() => change(v)} className={view === v ? 'active' : ''}>
            {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
      <button className="btn ghost sm" onClick={() => nav(-1)}>←</button>
      <button className="btn ghost sm" onClick={() => router.push(`/agenda?view=${view}&data=${encodeURIComponent(new Date().toISOString())}`)}>Hoje</button>
      <button className="btn ghost sm" onClick={() => nav(1)}>→</button>
    </div>
  )
}
