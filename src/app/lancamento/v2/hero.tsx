'use client'
/* Hero v2 — melhoria P1: proposta de valor CLARA + CTA acima da dobra, sem
   depender de scroll nem de WebGL. O hero 3D em partículas entra numa fase
   seguinte como CAMADA de ambiência atrás deste conteúdo, com fallback
   (prefers-reduced-motion / sem-WebGL / mobile). */
import React from 'react'
import { Spiral } from './core'
import { Hero3D } from './hero-3d'

export function Hero() {
  return (
    <header id="topo" className="hero-v2">
      {/* camada 3D (Three.js) com fallback canvas — ambiência atrás do conteúdo */}
      <div className="hero-v2-3dslot" aria-hidden="true"><Hero3D /></div>
      <div className="wrap hero-v2-inner">
        <div className="hero-v2-kicker">
          <Spiral size={22} sw={1.8} />
          <span>Inteligência Clínica Longitudinal</span>
        </div>

        <h1 className="serif hero-v2-title">
          Todo o consultório numa <em>memória que acompanha</em> cada paciente ao longo do tempo.
        </h1>

        <p className="hero-v2-sub">
          Agenda, pagamentos, videochamada e transcrição resolvidos num só lugar — e, acima de tudo,
          a <strong>continuidade</strong>: temas que reaparecem, objetivos que evoluem, a linha do tempo
          do caso. Para psicólogos que acompanham processos, não sessões isoladas.
        </p>

        <div className="hero-v2-cta">
          <a href="#acesso" className="btn-lp btn-lp-primary">Solicitar acesso antecipado →</a>
          <a href="#plataforma" className="btn-lp btn-lp-ghost">Ver como funciona</a>
        </div>

        <div className="hero-v2-reassure">
          Beta por convite · <strong>sem mensalidade durante o beta</strong> · a Audere observa, a decisão é sempre sua.
        </div>
      </div>
    </header>
  )
}
