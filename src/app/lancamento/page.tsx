/* Landing v2 (redesign). Nav + Hero com clareza acima da dobra (P1), narrativa
   (Problema, Tese, Módulos, Convergência, Privacidade, Manifesto, Trust) e, no
   fim, a compra.

   ago/2026: o programa beta acabou. A seção #acesso deixou de ser lista de
   espera e passou a ser a vitrine de planos — a mesma de /precos, componente
   compartilhado pra não haver preço divergente entre as duas telas. O backend
   de lista de espera segue existindo (admin → leads); só não é mais oferecido
   aqui. */
import { Nav } from './v2/nav'
import { Hero } from './v2/hero'
import { ProblemSection, ThesisSection } from './v2/sections-thesis'
import { ModulesSection, ConvergenceSection } from './v2/sections-modules'
import { PrivacySection, ManifestoSection, TrustSection, Footer } from './v2/sections-close'
import { Spiral } from './v2/core'
import { PLANOS } from '@/server/lib/planos'
import { PrecosTabela, type PlanoVitrine } from '../precos/PrecosTabela'

export default function LancamentoPage() {
  const planos: PlanoVitrine[] = (['free', 'essencial', 'pro'] as const).map(chave => ({
    chave,
    ...PLANOS[chave],
  }))

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

      {/* Compra — vitrine de planos (mesma de /precos) */}
      <section id="acesso" className="lp-acesso">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Spiral size={40} sw={1.6} color="#b9a6f5" tip="var(--sage)" />
          </div>
          <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#f4f1fb', lineHeight: 1.1 }}>
            Comece hoje, no <em style={{ fontStyle: 'italic', color: '#c9b8fb' }}>seu ritmo</em>.
          </h2>
          <p style={{ color: 'rgba(233,228,251,.72)', fontSize: 17, lineHeight: 1.6, margin: '18px auto 40px', maxWidth: 500 }}>
            Grátis para as três primeiras sessões do mês. Sem fidelidade, sem multa de cancelamento.
          </p>

          <PrecosTabela planos={planos} />
        </div>
      </section>

      <Footer />
    </div>
  )
}
