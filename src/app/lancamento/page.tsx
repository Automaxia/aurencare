/* Landing v2 (redesign). Fase 1: fundação (CSS/fontes/primitivas) + Nav + Hero
   com clareza acima da dobra (P1) + waitlist real. Seções da narrativa
   (Problema, Tese, Módulos, Convergência, Privacidade, Manifesto, Trust) e o
   hero 3D em Three.js entram nas fases seguintes. */
import { Nav } from './v2/nav'
import { Hero } from './v2/hero'
import { ProblemSection, ThesisSection } from './v2/sections-thesis'
import { ModulesSection, ConvergenceSection } from './v2/sections-modules'
import { PrivacySection, ManifestoSection, TrustSection, Footer } from './v2/sections-close'
import { ListaEsperaForm } from './ListaEsperaForm'
import { Spiral } from './v2/core'

export default function LancamentoPage() {
  return (
    <div className="lp" style={{ background: 'var(--page)', color: 'var(--ink)', fontFamily: 'var(--f-body)' }}>
      <Nav />
      <Hero />
      <ProblemSection />
      <ThesisSection />
      <ModulesSection />
      <ConvergenceSection />
      <PrivacySection />
      <ManifestoSection />
      <TrustSection />

      {/* CTA / waitlist real (backend) */}
      <section id="acesso" className="lp-acesso">
        <div className="wrap" style={{ textAlign: 'center', maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Spiral size={40} sw={1.6} color="#b9a6f5" tip="var(--sage)" />
          </div>
          <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#f4f1fb', lineHeight: 1.1 }}>
            Acesso antecipado ao <em style={{ fontStyle: 'italic', color: '#c9b8fb' }}>programa beta</em>.
          </h2>
          <p style={{ color: 'rgba(233,228,251,.72)', fontSize: 17, lineHeight: 1.6, margin: '18px auto 30px', maxWidth: 480 }}>
            Beta por convite, sem mensalidade durante o beta. Avisamos por email assim que seu acesso abrir.
          </p>
          <ListaEsperaForm />
        </div>
      </section>

      <Footer />
    </div>
  )
}
