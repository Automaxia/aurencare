'use client'

import { WidgetGrip } from '@/components/WidgetGrip'

type Props = {
  text: string | null
  loading: boolean
  numeroTurnos: number
}

/**
 * Observação ao vivo da IA — regenerada periodicamente durante a sessão.
 * §9 — linguagem observacional, sem diagnóstico. CFP 09/2024.
 */
export function LiveInsight({ text, loading, numeroTurnos }: Props) {
  return (
    <div className="sp wide" data-widget-id="live-insight" style={{ background: 'var(--card-warm)' }}>
      <WidgetGrip />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sp-t" style={{ margin: 0 }}>Observação ao vivo</div>
        <div style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: .6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading && <span className="rp" style={{ background: 'var(--accent)' }} />}
          {numeroTurnos > 0 ? `${numeroTurnos} turno${numeroTurnos > 1 ? 's' : ''}` : 'aguardando'}
        </div>
      </div>
      {text ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, fontWeight: 300 }}>{text}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--faint)' }}>
          {loading ? 'gerando primeira observação…' : 'a IA gera observações automaticamente a cada poucos turnos'}
        </p>
      )}
    </div>
  )
}
