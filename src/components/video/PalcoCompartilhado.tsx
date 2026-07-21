'use client'
/* Palco compartilhado da videochamada — o psicólogo "mostra" um widget do
   próprio site pro paciente (sem screen share). Renderiza read-only nos DOIS
   lados a partir do payload empurrado pelo canal app do WebRTC. Web-only (o pai,
   VideoCall, só monta no desktop). Fase 1: escala de objetivos. */
import { BulletChart } from '@/app/(app)/pacientes/[id]/objetivos/BulletChart'

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
  | null

export function PalcoCompartilhado({ palco, onFechar }: { palco: PalcoState; onFechar?: () => void }) {
  if (!palco) return null
  return (
    <div className="vc-palco" role="region" aria-label="Conteúdo compartilhado">
      <div className="vc-palco-card">
        {onFechar && (
          <button className="vc-palco-close" onClick={onFechar} title="Encerrar apresentação" aria-label="Encerrar apresentação">✕</button>
        )}
        {palco.widget === 'objetivos' && <PalcoObjetivos objetivos={palco.data.objetivos} />}
      </div>
    </div>
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
