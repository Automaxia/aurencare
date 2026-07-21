'use client'
/* Quadro branco da videochamada — Excalidraw embutido. O psicólogo desenha
   (editor), o paciente vê ao vivo (viewMode). Sync one-way: o editor emite a
   cena (throttle ~180ms) pelo canal app do WebRTC; o viewer aplica via
   updateScene. Excalidraw é pesado → lazy-load (ssr:false). */
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import '@excalidraw/excalidraw/index.css'

const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => <div className="vc-quadro-loading">Carregando o quadro…</div>,
})

type Props = {
  /** true = psicólogo (desenha) · false = paciente (só vê). */
  editor: boolean
  /** Elementos recebidos do outro lado (só usado pelo viewer). */
  scene?: any[] | null
  /** Emite a cena ao desenhar (só usado pelo editor). */
  onScene?: (elements: any[]) => void
}

export function QuadroBranco({ editor, scene, onScene }: Props) {
  const apiRef = useRef<any>(null)
  const pending = useRef<any[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Viewer: aplica a cena recebida.
  useEffect(() => {
    if (editor || !apiRef.current || !scene) return
    try { apiRef.current.updateScene({ elements: scene }) } catch { /* */ }
  }, [scene, editor])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className="vc-quadro-canvas">
      <Excalidraw
        excalidrawAPI={(api: any) => { apiRef.current = api }}
        viewModeEnabled={!editor}
        onChange={(elements: readonly any[]) => {
          if (!editor || !onScene) return
          // throttle com trailing: manda no máx ~5–6x/s a última cena.
          pending.current = elements as any[]
          if (timer.current) return
          timer.current = setTimeout(() => {
            timer.current = null
            if (pending.current) onScene(pending.current)
          }, 180)
        }}
      />
    </div>
  )
}
