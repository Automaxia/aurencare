'use client'

import { useEffect, useState } from 'react'

type UltimaSessao = { id: string; numero: number; dataHora: string; bullets: string[] }
type Condicoes = {
  cid?: string[]
  diagnosticos?: { nome: string; cid?: string }[]
  condicoes_clinicas?: string[]
  medicacoes?: { nome: string; dose?: string }[]
  alertas?: string[]
  observacoes?: string
}
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
    <div className="sp" data-widget-id="ultima">
      <div className="widget-grip" title="Arraste para reorganizar">⠿</div>
      <div className="sp-t">Última sessão</div>
      {loading ? <Skeleton lines={3} /> : !ctx?.ultima ? (
        <div className="sp-li" style={{ color: 'var(--faint)' }}>primeira sessão deste paciente</div>
      ) : ctx.ultima.bullets.length === 0 ? (
        <div className="sp-li" style={{ color: 'var(--faint)' }}>sessão sem bullets extraíveis</div>
      ) : (
        ctx.ultima.bullets.map((b, i) => <div key={i} className="sp-li">{b}</div>)
      )}
    </div>
  )
}

export function TopicosWidget({ ctx, loading }: { ctx: Ctx | null; loading: boolean }) {
  return (
    <div className="sp" data-widget-id="topicos">
      <div className="widget-grip" title="Arraste para reorganizar">⠿</div>
      <div className="sp-t">Tópicos em aberto</div>
      {loading ? <Skeleton lines={2} /> : !ctx?.topicos?.length ? (
        <div className="sp-li" style={{ color: 'var(--faint)' }}>sem tópicos extraídos</div>
      ) : (
        ctx.topicos.map((t, i) => <div key={i} className="sp-li">{t}</div>)
      )}
    </div>
  )
}

export function InfoPacienteWidget({ ctx, loading, pacienteId }: { ctx: Ctx | null; loading: boolean; pacienteId: string }) {
  const c = ctx?.condicoes
  const condicoes = c?.condicoes_clinicas ?? []
  const diagnosticos = c?.diagnosticos ?? (c?.cid ?? []).map(code => ({ nome: code, cid: undefined as string | undefined }))
  const meds = c?.medicacoes ?? []
  const alertas = c?.alertas ?? []

  return (
    <div className="sp wide" data-widget-id="info">
      <div className="widget-grip" title="Arraste para reorganizar">⠿</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
        <div className="sp-t" style={{ margin: 0 }}>Informações do paciente</div>
        <a href={`/pacientes/${pacienteId}`} style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '.6px', textTransform: 'uppercase' }}>prontuário ↗</a>
      </div>

      {loading ? <Skeleton lines={4} /> : !c || (condicoes.length === 0 && diagnosticos.length === 0 && meds.length === 0 && alertas.length === 0) ? (
        <div className="sp-li" style={{ color: 'var(--faint)' }}>
          sem condições registradas · <a href={`/pacientes/${pacienteId}`} style={{ color: 'var(--accent)' }}>preencher</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            {condicoes.length > 0 && (
              <div className="info-block">
                <div className="sp-t" style={{ marginBottom: 6 }}>Condições</div>
                <div className="info-pills">
                  {condicoes.map((c, i) => <span key={i} className="info-pill">{c}</span>)}
                </div>
              </div>
            )}
            {diagnosticos.length > 0 && (
              <div className="info-block">
                <div className="sp-t" style={{ marginBottom: 6 }}>Diagnósticos clínicos</div>
                <ul className="info-list">
                  {diagnosticos.map((d, i) => (
                    <li key={i}><span>{d.nome}</span>{d.cid && <span className="sub">{d.cid}</span>}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            {meds.length > 0 && (
              <div className="info-block">
                <div className="sp-t" style={{ marginBottom: 6 }}>Medicações em uso</div>
                <ul className="info-list">
                  {meds.map((m, i) => (
                    <li key={i}><span>{m.nome}</span>{m.dose && <span className="sub">{m.dose}</span>}</li>
                  ))}
                </ul>
              </div>
            )}
            {alertas.length > 0 && (
              <div className="info-block">
                <div className="sp-t" style={{ marginBottom: 6 }}>Alertas</div>
                <div className="info-pills">
                  {alertas.map((a, i) => <span key={i} className="info-pill alert">{a}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
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
