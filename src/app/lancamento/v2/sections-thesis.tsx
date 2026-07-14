'use client'
/* Seções A — O Problema · A Tese (4 gerações). Espinha argumentativa; portada
   fielmente (a redundância a consolidar por P2 está no Manifesto, não aqui). */
import React from 'react'
import { Section, Eyebrow, Display, useInView } from './core'

export function ProblemSection() {
  const lines = [
    'Temas reaparecem, padrões se repetem, objetivos evoluem — ao longo de meses.',
    'Mas cada ferramenta disponível até então tratava a sessão de hoje como se fosse a primeira.',
    'O que liga uma sessão à outra acabava disperso: anotações, áudios e planilhas soltas.',
  ]
  return (
    <Section id="problema" tint>
      <div className="prob-grid">
        <div>
          <Eyebrow color="var(--rose-text)">O problema</Eyebrow>
          <Display size="clamp(32px,4.2vw,58px)" style={{ marginTop: 20, maxWidth: 760 }}>
            A terapia acontece ao longo do tempo. As ferramentas até então, <em style={{ color: 'var(--accent)' }}>analisavam somente uma sessão por vez.</em>
          </Display>
        </div>
        <div className="prob-lines">
          {lines.map((l, i) => (
            <div className="prob-line" key={i}>
              <span className="prob-bar" style={{ animationDelay: i * 0.15 + 's' }} />
              <p>{l}</p>
            </div>
          ))}
          <p className="prob-close">A continuidade ficava por sua conta, sem nenhum sistema para sustentá-la.</p>
        </div>
      </div>
    </Section>
  )
}

const GENERATIONS = [
  { n: '1ª geração', k: 'Agenda digital',        d: 'organiza o tempo' },
  { n: '2ª geração', k: 'Prontuário eletrônico', d: 'organiza o arquivo' },
  { n: '3ª geração', k: 'Transcrição com IA',    d: 'organiza a sessão' },
  { n: '4ª geração', k: 'Continuidade clínica',  d: 'organiza o processo', on: true },
]

export function ThesisSection() {
  const [ref, , seen] = useInView({ rootMargin: '0px 0px -20%' })
  return (
    <Section id="tese">
      <div style={{ textAlign: 'center' }}>
        <Eyebrow style={{ justifyContent: 'center' }}>A tese</Eyebrow>
        <Display size="clamp(34px,4.8vw,68px)" style={{ marginTop: 18 }}>
          Resolveram a sessão. <em style={{ color: 'var(--accent)' }}>Não o tratamento.</em>
        </Display>
        <p className="sec-lead" style={{ margin: '26px auto 0', textAlign: 'center' }}>
          Registrar cada sessão virou fácil. O difícil sempre foi conectar todas elas, ao longo de meses.
          É a peça que faltava, e a única que cresce a cada sessão.
        </p>
      </div>

      <div className="thesis-track" ref={ref as any}>
        {GENERATIONS.map((g, i) => (
          <React.Fragment key={g.k}>
            <div className={'thesis-card' + (g.on ? ' on' : '') + (seen ? ' in' : '')}
              style={{ transitionDelay: (i * 0.12) + 's' }}>
              <span className="thesis-gen">{g.n}</span>
              <div className="thesis-k serif">{g.k}</div>
              <div className="thesis-d">{g.d}</div>
            </div>
            {i < GENERATIONS.length - 1 && <span className="thesis-arrow" aria-hidden="true">→</span>}
          </React.Fragment>
        ))}
      </div>

      <p className="thesis-close serif">
        A sessão de hoje, toda plataforma registra. <em>Os anos de continuidade de cada paciente são a premissa sobre a qual a Audere foi construída.</em>
      </p>

      {/* P3 — CTA no meio da página, depois do valor estabelecido pela Tese */}
      <div className="lp-midcta">
        <a href="#acesso" className="btn-lp btn-lp-primary" onClick={(e) => { e.preventDefault(); document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth' }) }}>
          Solicitar acesso antecipado →
        </a>
        <span className="lp-midcta-note">Beta por convite · sem mensalidade durante o beta</span>
      </div>
    </Section>
  )
}
