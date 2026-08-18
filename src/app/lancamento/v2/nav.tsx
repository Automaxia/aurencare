'use client'
import React, { useState, useEffect } from 'react'
import { Spiral } from './core'

const LINKS: [string, string][] = [
  ['problema', 'Continuidade'],
  ['plataforma', 'Plataforma'],
  ['privacidade', 'Privacidade'],
  ['confianca', 'Feito por psicólogos'],
  ['acesso', 'Planos'],
]

/** Nav: transparente no topo, sólida ao rolar. CTA persistente (P3). */
export function Nav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <nav className={'nav' + (solid ? ' solid' : '')}>
      <div className="wrap nav-inner">
        <a href="#topo" className="nav-brand" onClick={go('topo')}>
          <Spiral size={32} sw={1.8} color="var(--accent)" tip="var(--sage)" />
          <span className="nav-name">Audere</span>
        </a>
        <div className="nav-links">
          {LINKS.map(([id, label]) => (
            <a key={id} href={'#' + id} onClick={go(id)}>{label}</a>
          ))}
        </div>
        <a href="#acesso" className="nav-cta" onClick={go('acesso')}>Ver planos →</a>
      </div>
    </nav>
  )
}
