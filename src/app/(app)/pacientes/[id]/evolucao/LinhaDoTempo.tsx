'use client'

import { useEffect, useState } from 'react'
import type { TimelineEvento } from '@/server/services/linhaDoTempo'

const TIPO_COR: Record<string, string> = {
  inicio: 'var(--muted)', insight: 'var(--accent)', avanco: 'var(--sage)',
  mudanca: 'var(--amber)', observacao: 'var(--faint)', objetivo: 'var(--accent)', concluido: 'var(--sage)',
}
const TIPO_DOT: Record<string, string> = {
  inicio: '●', insight: '◇', avanco: '◆', mudanca: '▲', observacao: '○', objetivo: '◬', concluido: '★',
}

type Estado = { fase: 'carregando' } | { fase: 'pronto'; eventos: TimelineEvento[] } | { fase: 'erro' }

export function LinhaDoTempo({ pacienteId }: { pacienteId: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })

  useEffect(() => {
    let cancel = false
    fetch(`/api/pacientes/${pacienteId}/timeline`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((j: { eventos?: TimelineEvento[] }) => { if (!cancel) setEstado({ fase: 'pronto', eventos: Array.isArray(j.eventos) ? j.eventos : [] }) })
      .catch(() => { if (!cancel) setEstado({ fase: 'erro' }) })
    return () => { cancel = true }
  }, [pacienteId])

  // Agrupa por mês preservando a ordem cronológica.
  const grupos: { mes: string; itens: TimelineEvento[] }[] = []
  if (estado.fase === 'pronto') {
    for (const e of estado.eventos) {
      const mes = new Date(e.data).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const ult = grupos[grupos.length - 1]
      if (ult && ult.mes === mes) ult.itens.push(e)
      else grupos.push({ mes, itens: [e] })
    }
  }

  return (
    <section>
      <div className="sec-lbl" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Linha do tempo clínica</span>
        <span style={{ fontSize: 10, color: 'var(--faint)' }}>narrativa do processo</span>
      </div>

      {estado.fase === 'carregando' && (
        <div className="card" style={{ padding: 18, color: 'var(--muted)', fontSize: 12 }}>Montando a linha do tempo…</div>
      )}
      {estado.fase === 'erro' && <div className="empty">Não foi possível carregar a linha do tempo agora.</div>}
      {estado.fase === 'pronto' && grupos.length === 0 && (
        <div className="empty">A linha do tempo aparece conforme você assina sessões e cria objetivos.</div>
      )}
      {estado.fase === 'pronto' && grupos.length > 0 && (
        <div className="card" style={{ padding: '18px 20px' }}>
          {grupos.map((g, gi) => (
            <div key={gi} style={{ marginBottom: gi === grupos.length - 1 ? 0 : 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize', fontWeight: 500, marginBottom: 8 }}>{g.mes}</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                {g.itens.map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ color: TIPO_COR[e.tipo] ?? 'var(--muted)', fontSize: 12, flex: 'none', width: 14, textAlign: 'center' }}>{TIPO_DOT[e.tipo] ?? '•'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{e.titulo}</span>
                      {e.sessao ? <span style={{ fontSize: 11, color: 'var(--faint)' }}> · sessão {e.sessao}</span> : null}
                      {e.descricao ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.45 }}>{e.descricao}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
