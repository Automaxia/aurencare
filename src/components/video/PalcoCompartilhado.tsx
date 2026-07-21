'use client'
/* Palco compartilhado da videochamada — o psicólogo "mostra" um widget do
   próprio site pro paciente (sem screen share). Renderiza read-only nos DOIS
   lados a partir do payload empurrado pelo canal app do WebRTC. Web-only (o pai,
   VideoCall, só monta no desktop). Fase 1: escala de objetivos. */
import React, { useState, useRef } from 'react'
import { BulletChart } from '@/app/(app)/pacientes/[id]/objetivos/BulletChart'
import { GrafoCanvas } from '@/app/(app)/pacientes/[id]/temas/GrafoCanvas'
import { ChecagemHumor } from './ChecagemHumor'

export type PalcoObjetivo = {
  titulo: string
  tipo: 'gas' | 'absoluta' | 'nenhuma'
  unidade: string | null
  baseline: number | null
  alvo: number | null
  direcao: 'aumentar' | 'diminuir'
  atual: number | null
}
export type PalcoState =
  | { widget: 'objetivos'; data: { objetivos: PalcoObjetivo[] } }
  | { widget: 'grafo'; data: { grafo: any } }
  | { widget: 'quadro' }
  | { widget: 'humor' }
  | null

export function PalcoCompartilhado({ palco, onFechar, role, humorResposta, onResponderHumor }: {
  palco: PalcoState
  onFechar?: () => void
  role?: 'psicologo' | 'paciente'
  humorResposta?: number | null
  onResponderHumor?: (valor: number) => void
}) {
  // Janela arrastável: a alça (topo do card) reposiciona o card dentro do quadro.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const drag = useRef<{ sx: number; sy: number; bl: number; bt: number } | null>(null)
  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const card = e.currentTarget.parentElement as HTMLElement | null
    const parent = card?.parentElement as HTMLElement | null
    if (!card || !parent) return
    const r = card.getBoundingClientRect(), p = parent.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, bl: r.left - p.left, bt: r.top - p.top }
    setPos({ left: r.left - p.left, top: r.top - p.top })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current; if (!d) return
    const card = e.currentTarget.parentElement as HTMLElement | null
    const parent = card?.parentElement as HTMLElement | null
    if (!card || !parent) return
    const p = parent.getBoundingClientRect()
    const left = Math.max(4, Math.min(d.bl + (e.clientX - d.sx), p.width - card.offsetWidth - 4))
    const top = Math.max(4, Math.min(d.bt + (e.clientY - d.sy), p.height - card.offsetHeight - 4))
    setPos({ left, top })
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
  }

  if (!palco) return null
  return (
    <div className="vc-palco" role="region" aria-label="Conteúdo compartilhado">
      <div
        className={'vc-palco-card' + (palco.widget === 'grafo' ? ' vc-palco-card--grafo' : '')}
        style={pos ? { position: 'absolute', left: pos.left, top: pos.top, margin: 0 } : undefined}
      >
        <div className="vc-palco-drag" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} title="Arraste para mover">⠿⠿</div>
        {onFechar && (
          <button className="vc-palco-close" onClick={onFechar} title="Encerrar apresentação" aria-label="Encerrar apresentação">✕</button>
        )}
        {palco.widget === 'objetivos' && <PalcoObjetivos objetivos={palco.data.objetivos} />}
        {palco.widget === 'grafo' && <PalcoGrafo grafo={palco.data.grafo} />}
        {palco.widget === 'humor' && (
          <ChecagemHumor role={role ?? 'paciente'} resposta={humorResposta ?? null} onResponder={onResponderHumor} />
        )}
      </div>
    </div>
  )
}

function PalcoGrafo({ grafo }: { grafo: any }) {
  const [sel, setSel] = useState<any>(null)
  const vazio = !grafo?.nodes || grafo.nodes.length === 0
  return (
    <>
      <div className="vc-palco-titulo">Temas recorrentes</div>
      {vazio ? (
        <div className="vc-palco-vazio">Ainda não há temas mapeados para mostrar.</div>
      ) : (
        <div className="vc-palco-grafo">
          <GrafoCanvas grafo={grafo} selecionado={sel} onSelect={setSel} />
        </div>
      )}
    </>
  )
}

function PalcoObjetivos({ objetivos }: { objetivos: PalcoObjetivo[] }) {
  return (
    <>
      <div className="vc-palco-titulo">Objetivos terapêuticos</div>
      {!objetivos || objetivos.length === 0 ? (
        <div className="vc-palco-vazio">Nenhum objetivo ativo para mostrar.</div>
      ) : (
        <div className="vc-palco-objs">
          {objetivos.map((o, i) => (
            <div key={i} className="vc-palco-obj">
              <div className="vc-palco-obj-nome">{o.titulo}</div>
              <BulletChart
                baseline={o.baseline} alvo={o.alvo} atual={o.atual}
                direcao={o.direcao} tipo={o.tipo} unidade={o.unidade} size="lg"
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
