import { PLANOS } from '@/server/lib/planos'
import { Nav } from '../lancamento/v2/nav'
import { Footer } from '../lancamento/v2/sections-close'
import { Spiral } from '../lancamento/v2/core'
import { PrecosTabela, type PlanoVitrine } from './PrecosTabela'

export const dynamic = 'force-dynamic'

/**
 * Vitrine pública de planos. A compra em si acontece depois do cadastro, no
 * checkout de `/planos` — aqui a pessoa só escolhe, e a escolha viaja na URL
 * (`/cadastro?plano=&ciclo=`) até lá.
 */
export default function PrecosPage() {
  const planos: PlanoVitrine[] = (['free', 'essencial', 'pro'] as const).map(chave => ({
    chave,
    ...PLANOS[chave],
  }))

  return (
    <div className="lp" style={{ background: 'var(--page)', color: 'var(--ink)', fontFamily: 'var(--f-body)' }}>
      <Nav />

      <section id="acesso" className="lp-acesso" style={{ paddingTop: 'clamp(120px, 13vw, 180px)' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Spiral size={40} sw={1.6} color="#b9a6f5" tip="var(--sage)" />
          </div>
          <h1 className="serif" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#f4f1fb', lineHeight: 1.1 }}>
            Um preço por <em style={{ fontStyle: 'italic', color: '#c9b8fb' }}>prática</em>, não por paciente.
          </h1>
          <p style={{ color: 'rgba(233,228,251,.72)', fontSize: 17, lineHeight: 1.6, margin: '18px auto 40px', maxWidth: 520 }}>
            Comece grátis e mude de plano quando a agenda pedir. Sem fidelidade, sem multa de cancelamento.
          </p>

          <PrecosTabela planos={planos} />
        </div>
      </section>

      <Footer />
    </div>
  )
}
