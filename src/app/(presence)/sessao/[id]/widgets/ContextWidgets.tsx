'use client'

import { useEffect, useState } from 'react'

type UltimaSessao = { id: string; numero: number; dataHora: string; bullets: string[] }
type Condicoes = { cid?: string[]; medicacoes?: { nome: string; dose?: string }[]; alertas?: string[]; observacoes?: string }
type Ctx = { ultima: UltimaSessao | null; condicoes: Condicoes | null; topicos: string[] }

export function useContexto(sessaoId: string) {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    fetch(`/api/sessao/${sessaoId}/contexto`)
      .then(r => r.json())
      .then(setCtx)
      .catch(() => setCtx(null))
      .finally(() => setLoading(false))
  }, [sessaoId])
  return { ctx, loading }
}

export function UltimaSessaoWidget({ ctx, loading }: { ctx: Ctx | null; loading: boolean }) {
  return (
    <div className="widget wide" data-widget-id="ultima">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">Última sessão</div>
      {loading ? <Skeleton lines={3} /> : !ctx?.ultima ? (
        <Empty>Primeira sessão do paciente.</Empty>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
            Sessão #{ctx.ultima.numero} · {new Date(ctx.ultima.dataHora).toLocaleDateString('pt-BR')}
          </div>
          {ctx.ultima.bullets.length === 0 ? (
            <Empty>Sessão sem bullets extraíveis.</Empty>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              {ctx.ultima.bullets.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function TopicosWidget({ ctx, loading }: { ctx: Ctx | null; loading: boolean }) {
  return (
    <div className="widget" data-widget-id="topicos">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">Tópicos em aberto</div>
      {loading ? <Skeleton lines={3} /> : !ctx?.topicos?.length ? (
        <Empty>Sem tópicos extraídos.</Empty>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {ctx.topicos.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}
        </ul>
      )}
    </div>
  )
}

export function InfoPacienteWidget({ ctx, loading, pacienteId }: { ctx: Ctx | null; loading: boolean; pacienteId: string }) {
  const c = ctx?.condicoes
  return (
    <div className="widget" data-widget-id="info">
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">
        Informações do paciente
        <a href={`/pacientes/${pacienteId}`} style={{ float: 'right', fontSize: 10, color: 'var(--muted)' }}>editar</a>
      </div>
      {loading ? <Skeleton lines={3} /> : !c ? (
        <Empty>Sem condições registradas. <a href={`/pacientes/${pacienteId}`} style={{ color: 'var(--accent)' }}>preencher</a></Empty>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {c.cid && c.cid.length > 0 && <KV k="CID" v={c.cid.join(', ')} />}
          {c.medicacoes && c.medicacoes.length > 0 && (
            <KV k="Medicação" v={c.medicacoes.map(m => `${m.nome}${m.dose ? ' ' + m.dose : ''}`).join(', ')} />
          )}
          {c.alertas && c.alertas.length > 0 && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--rose-lo)', borderRadius: 6, fontSize: 11, color: 'var(--rose)' }}>
              ⚠ {c.alertas.join(' · ')}
            </div>
          )}
          {c.observacoes && <p style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>{c.observacoes}</p>}
        </div>
      )}
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
      <span style={{ color: 'var(--muted)', minWidth: 64 }}>{k}</span>
      <span>{v}</span>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{children}</div>
}
function Skeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: 10, background: 'var(--surface)', borderRadius: 4, marginBottom: 6, width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}
