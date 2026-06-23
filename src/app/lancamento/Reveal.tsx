'use client'

import { useEffect } from 'react'

/**
 * Observador global: revela TODO elemento com a classe `.lp-reveal` ao entrar na
 * viewport (fade + sobe). Sem dependência — um único IntersectionObserver pra
 * a landing inteira. Respeita prefers-reduced-motion (mostra tudo de imediato).
 * Renderize uma vez na página; marque as seções com className="... lp-reveal".
 */
export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'))
    if (els.length === 0) return

    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduz) { els.forEach(e => e.classList.add('in')); return }

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [])

  return null
}
