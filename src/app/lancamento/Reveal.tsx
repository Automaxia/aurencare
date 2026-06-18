'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Revela o conteúdo ao entrar na viewport (fade + sobe). Sem dependência —
 * IntersectionObserver puro. Estilo em .lp-reveal (style jsx global da landing).
 * `delay` (ms) permite escalonar elementos vizinhos.
 */
export function Reveal({ children, delay = 0, style }: {
  children: React.ReactNode
  delay?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisivel(true); io.disconnect() } },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`lp-reveal${visivel ? ' in' : ''}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}
