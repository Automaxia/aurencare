import { LogoMark } from '@/components/brand/Logo'
import Link from 'next/link'
import { CadastroForm } from './form'

export const dynamic = 'force-dynamic'

const DIFERENCIAIS = [
  'Memória Clínica Longitudinal',
  'Objetivos Terapêuticos',
  'Evolução Registrada',
  'Continuidade Terapêutica',
  'Privacidade por Design',
]

const PASSOS = [
  'Configure sua prática clínica.',
  'Cadastre seu primeiro paciente.',
  'Registre sua primeira sessão.',
  'Explore a memória clínica gerada pela Audere.',
]

const CONFIANCA = ['Dados criptografados', 'Conformidade com LGPD', 'CFP 09/2024', 'Zero Data Training']

export default function CadastroPage() {
  return (
    <div className="login-split">
      {/* ── Esquerda — posicionamento + expectativa de valor ── */}
      <aside className="login-aside">
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <LogoMark size={42} />
          <div>
            <div className="wm"><i>Au</i><b>dere</b></div>
            <div className="eyebrow" style={{ marginTop: 5 }}>Continuidade Terapêutica</div>
          </div>
        </div>

        <h1 className="login-head">
          Crie sua conta na primeira plataforma de Continuidade Terapêutica do Brasil.
        </h1>

        <div className="login-pitch" style={{ display: 'grid', gap: 24 }}>
          <p className="login-sub">
            Acompanhe sessões, objetivos terapêuticos, evolução e memória clínica
            em um único lugar.
          </p>

          <ul className="login-diffs">
            {DIFERENCIAIS.map(d => (
              <li key={d}><span className="ck">✓</span>{d}</li>
            ))}
          </ul>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.9)', marginBottom: 12, letterSpacing: '.02em' }}>
              O que acontece depois de criar sua conta?
            </div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 11 }}>
              {PASSOS.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 13, color: 'rgba(255,255,255,.88)', lineHeight: 1.45 }}>
                  <span style={{
                    flex: 'none', width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(255,255,255,.16)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                  }}>{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      {/* ── Direita — formulário ── */}
      <main className="login-main">
        <div className="card" style={{ width: 'min(440px, 92vw)', padding: 28 }}>
          <h2 style={{ marginBottom: 4 }}>Criar sua conta</h2>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
            Leva menos de 2 minutos. O restante configuramos junto com você.
          </p>

          <CadastroForm />

          <div className="login-trust" style={{ marginTop: 18, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            {CONFIANCA.map(c => <span key={c}>🔒 {c}</span>)}
          </div>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12.5, color: 'var(--muted)' }}>
            Já utiliza a Audere? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Entrar →</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
