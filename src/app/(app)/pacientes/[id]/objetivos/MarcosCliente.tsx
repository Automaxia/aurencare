'use client'

import { useEffect, useState } from 'react'
import type { Marco } from '@/server/services/marcos'
import { formatDateBR } from '@/lib/formatters'

const TIPO_LABEL: Record<Marco['tipo'], string> = {
  inicio:     'início',
  insight:    'insight',
  avanco:     'avanço',
  mudanca:    'mudança',
  observacao: 'observação',
}
const TIPO_COLOR: Record<Marco['tipo'], string> = {
  inicio:     'var(--muted)',
  insight:    'var(--accent)',
  avanco:     'var(--sage)',
  mudanca:    'var(--amber)',
  observacao: 'var(--faint)',
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; marcos: Marco[] }
  | { fase: 'erro' }

export function MarcosCliente({ pacienteId }: { pacienteId: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })

  useEffect(() => {
    let cancelado = false
    fetch(`/api/pacientes/${pacienteId}/marcos`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((j: { marcos?: Marco[] }) => {
        if (!cancelado) setEstado({ fase: 'pronto', marcos: Array.isArray(j.marcos) ? j.marcos : [] })
      })
      .catch(() => { if (!cancelado) setEstado({ fase: 'erro' }) })
    return () => { cancelado = true }
  }, [pacienteId])

  return (
    <section>
      <div className="sec-lbl" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Marcos do processo</span>
        <span style={{ fontSize: 10, color: 'var(--faint)' }}>extraído pela Auren</span>
      </div>

      {estado.fase === 'carregando' && <Skeleton />}
      {estado.fase === 'erro' && (
        <div className="empty">Não foi possível carregar os marcos agora.</div>
      )}
      {estado.fase === 'pronto' && estado.marcos.length === 0 && (
        <div className="empty">Marcos aparecem após pelo menos 2 sessões assinadas com resumo.</div>
      )}
      {estado.fase === 'pronto' && estado.marcos.length > 0 && (
        <div className="card" style={{ position: 'relative', padding: '18px 20px 18px 28px' }}>
          <div style={{ position: 'absolute', left: 14, top: 18, bottom: 18, width: 2, background: 'var(--border)' }} />
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 16 }}>
            {estado.marcos.map((m, i) => (
              <li key={i} style={{ position: 'relative', paddingLeft: 14 }}>
                <span style={{
                  position: 'absolute', left: -8, top: 6,
                  width: 10, height: 10, borderRadius: '50%',
                  background: TIPO_COLOR[m.tipo], border: '2px solid var(--card)',
                  boxShadow: '0 0 0 1px var(--border)',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>{m.titulo}</div>
                  <span style={{ fontSize: 10, color: TIPO_COLOR[m.tipo], textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    {TIPO_LABEL[m.tipo]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                  Sessão #{m.numero} · {formatDateBR(m.data)}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{m.descricao}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : undefined,
        }}>
          <div style={shimmer(70, 12)} />
          <div style={shimmer(40, 9)} />
          <div style={shimmer(95, 10)} />
        </div>
      ))}
      <style jsx>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

function shimmer(widthPct: number, heightPx: number): React.CSSProperties {
  return {
    height: heightPx, width: `${widthPct}%`, borderRadius: 4,
    background: 'linear-gradient(90deg, var(--surface), rgba(0,0,0,.06), var(--surface))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  }
}
