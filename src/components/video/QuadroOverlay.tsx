'use client'
/* Overlay fullscreen do quadro branco. Via portal pro document.body — escapa da
   janela compacta/arrastável do Modo Presença (que tem transform e prenderia um
   position:fixed). O áudio da chamada continua; o quadro é a atividade em foco. */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'

// Dinâmico: o Excalidraw (JS + CSS pesados) só carrega quando o quadro abre,
// não em toda página de vídeo.
const QuadroBranco = dynamic(() => import('./QuadroBranco').then(m => m.QuadroBranco), { ssr: false })

type Props = {
  editor: boolean
  scene?: any[] | null
  onScene?: (elements: any[]) => void
  /** Só o psicólogo fecha (encerra a apresentação pros dois). */
  onFechar?: () => void
}

export function QuadroOverlay({ editor, scene, onScene, onFechar }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div className="vc-quadro-overlay" role="region" aria-label="Quadro branco compartilhado">
      <div className="vc-quadro-header">
        <span className="vc-quadro-titulo">
          Quadro branco{editor ? '' : ' · ao vivo'}
        </span>
        {onFechar && (
          <button className="vc-quadro-fechar" onClick={onFechar}>Fechar quadro</button>
        )}
      </div>
      <QuadroBranco editor={editor} scene={scene} onScene={onScene} />
    </div>,
    document.body,
  )
}
