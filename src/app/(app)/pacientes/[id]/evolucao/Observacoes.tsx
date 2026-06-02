'use client'

import { useEffect, useState } from 'react'
import type { TemaDescritivo, Instrumento } from '@/server/services/evolucao'

/**
 * Lado-cliente da página de Evolução. Renderiza skeleton imediato e
 * faz fetch das observações IA depois do paint, sem bloquear SSR.
 * Cache Redis 24h no backend → respostas subsequentes ~50ms.
 */

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronto'; temas: TemaDescritivo[]; instrumentos: Instrumento[] }
  | { fase: 'erro' }

export function ObservacoesCliente({ pacienteId }: { pacienteId: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })

  useEffect(() => {
    let cancelado = false
    fetch(`/api/pacientes/${pacienteId}/evolucao/observacoes`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((j: { temas?: TemaDescritivo[]; instrumentos?: Instrumento[] }) => {
        if (cancelado) return
        setEstado({
          fase: 'pronto',
          temas: Array.isArray(j.temas) ? j.temas : [],
          instrumentos: Array.isArray(j.instrumentos) ? j.instrumentos : [],
        })
      })
      .catch(() => { if (!cancelado) setEstado({ fase: 'erro' }) })
    return () => { cancelado = true }
  }, [pacienteId])

  return (
    <>
      {/* Histórico de temas recorrentes */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-h" style={{ padding: '14px 18px' }}>
          <span className="card-title">Histórico de temas recorrentes</span>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {estado.fase === 'carregando' && <Skel linhas={3} />}
          {estado.fase === 'erro' && <ErroBox />}
          {estado.fase === 'pronto' && estado.temas.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Sem temas extraídos ainda. Assine algumas sessões para começar.
            </div>
          )}
          {estado.fase === 'pronto' && estado.temas.map((t, i) => (
            <div key={i} className={`tema-card ${t.positivo ? 'positivo' : 'neutro'}`}>
              <div className="tema-card-h">{t.titulo}</div>
              <div className="tema-card-b">{t.descricao}</div>
              {t.trend && <div className="tema-card-trend">→ {t.trend}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Instrumentos */}
      {estado.fase === 'pronto' && estado.instrumentos.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-h" style={{ padding: '14px 18px' }}>
            <span className="card-title">Instrumentos a considerar</span>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>baseado no histórico</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {estado.instrumentos.map((i, idx) => {
              const klass = i.id === 'PHQ-9' ? 'phq9' : i.id === 'GAD-7' ? 'gad7' : 'phq9'
              return (
                <div key={idx} className={`instr-card ${klass}`}>
                  <div className="instr-name">{i.id}</div>
                  <div className="instr-body">{i.justificativa}</div>
                </div>
              )
            })}
            <div style={{
              fontSize: 11, color: 'var(--faint)', lineHeight: 1.55,
              padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--rsm)',
            }}>
              A aplicação de qualquer instrumento é decisão exclusiva do psicólogo responsável.
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Skel({ linhas }: { linhas: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} style={{
          padding: '12px 14px', borderRadius: 8,
          background: 'var(--surface)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{
            height: 12, width: '70%', borderRadius: 4,
            background: 'linear-gradient(90deg, var(--surface), rgba(0,0,0,.06), var(--surface))',
            backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
          }} />
          <div style={{
            height: 10, width: '95%', borderRadius: 4,
            background: 'linear-gradient(90deg, var(--surface), rgba(0,0,0,.04), var(--surface))',
            backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
          }} />
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

function ErroBox() {
  return (
    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
      Não foi possível carregar as observações agora. Tente recarregar a página.
    </div>
  )
}
