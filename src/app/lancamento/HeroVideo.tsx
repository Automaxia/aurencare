'use client'

import { useEffect, useRef } from 'react'

/**
 * Vídeo da logo (espiral) no herói. Componente cliente pra FORÇAR o autoplay:
 * alguns navegadores ignoram `autoplay` em SSR/com faixa de áudio — então
 * setamos muted e chamamos play() no mount. Vídeo é portrait (704×1248).
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch(() => { /* autoplay bloqueado — fica no 1º frame */ })
  }, [])

  return (
    <video
      ref={ref}
      className="lp-hero-video"
      src="/video.mp4"
      autoPlay muted loop playsInline preload="auto" aria-hidden
      style={{ height: 200, width: 'auto', maxWidth: '70%', margin: '-6px auto 4px', display: 'block', objectFit: 'contain' }}
    />
  )
}
