import { Logo } from '@/components/brand/Logo'
import { ListaEsperaForm } from './ListaEsperaForm'
import { RevealObserver } from './Reveal'
import { Hero } from './Hero'
import { ModulesGrid } from './ModulesDemo'
import { ConvergenceLayer } from './ConvergenceLayer'
import { JornadaContinuidade } from './Journey'

export const dynamic = 'force-dynamic'

export default function LancamentoPage() {
  return (
    <div style={{ background: 'var(--page)', color: 'var(--ink)', overflowX: 'clip' }}>
      <NavTopo />
      <Hero />
      {/* Narrativa de categoria: problema → o que é continuidade → o que a Audere
          lembra → grafo (protagonista) → objetivos/evolução → sessão (menor) →
          infraestrutura → privacidade → manifesto → prova social → acesso. */}
      <Problema />
      <JornadaContinuidade />
      <PraticaIntegrada />
      <Privacidade />
      <Manifesto />
      <ProvaSocial />
      <CtaFinal />
      <FooterLanding />
      <RevealObserver />
      <Styles />
    </div>
  )
}

// ─── Navegação topo ────────────────────────────────────────────────────

function NavTopo() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(249,248,245,.85)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 0',
      }}>
        <a href="/lancamento" style={{ display: 'flex', textDecoration: 'none' }}>
          <Logo size={32} />
        </a>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <a href="#continuidade" className="lp-link">Continuidade</a>
          <a href="#observar"     className="lp-link">O que ela lembra</a>
          <a href="#sessao"       className="lp-link">Sessão</a>
          <a href="#privacidade"  className="lp-link">Privacidade</a>
          <a href="#acesso"       className="lp-link" style={{ color: 'var(--accent)' }}>Acesso antecipado</a>
        </nav>
      </div>
    </header>
  )
}

// ─── Croqui (figura solta de /public/landing/) ─────────────────────────

function Figura({ src, style, opacity = 1, className }: {
  src: string; style?: React.CSSProperties; opacity?: number; className?: string
}) {
  return (
    <div aria-hidden className={className} style={{
      position: 'absolute', pointerEvents: 'none',
      backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain', backgroundPosition: 'center',
      opacity, mixBlendMode: 'multiply',
      ...style,
    }} />
  )
}

// ─── Bloco 1 — O problema ──────────────────────────────────────────────

function Problema() {
  const linhas = [
    'Depois de dezenas de sessões, é natural esquecer detalhes importantes.',
    'Temas reaparecem. Padrões se repetem. Objetivos evoluem.',
    'Anotações se acumulam — e parte da história acaba ficando dispersa.',
  ]
  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap lp-reveal" style={{ maxWidth: 760 }}>
        <Eyebrow>O problema</Eyebrow>
        <H2>A terapia acontece ao longo do tempo.<br />A memória humana não.</H2>
        <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
          {linhas.map((l, i) => (
            <p key={i} style={{ fontSize: 17, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{l}</p>
          ))}
        </div>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, fontStyle: 'italic',
          color: '#291860', lineHeight: 1.4, margin: '26px 0 0',
        }}>
          A Audere foi criada para resolver exatamente isso.
        </p>
      </div>
    </section>
  )
}

function NotaCard({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 22, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{
        fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase',
        letterSpacing: '.07em', fontWeight: 500, marginBottom: 8,
      }}>{rotulo}</div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65, margin: 0 }}>{children}</p>
    </div>
  )
}

// ─── Bloco 8 — Infraestrutura da prática (reposicionado pra baixo) ─────

function PraticaIntegrada() {
  return (
    <section id="gestao" style={{
      padding: '72px 0',
      borderTop: '1px solid var(--border)',
    }}>
      {/* Camada 1 — a plataforma completa (o mínimo esperado) */}
      <div className="lp-wrap lp-reveal">
        <Eyebrow>Do agendamento à evolução</Eyebrow>
        <H2>Tudo o que você precisa para cuidar do consultório.<br />Tudo o que faltava para acompanhar o tratamento.</H2>
        <P>
          Agenda, WhatsApp, videochamada, transcrição, prontuário, pagamentos, gestão
          financeira e as automações do consultório já fazem parte da Audere — uma
          plataforma completa para a sua prática, não apenas uma ferramenta de transcrição.
        </P>

        <ModulesGrid />
      </div>

      {/* Camada 2 — o diferencial: tudo converge pra continuidade */}
      <div className="lp-wrap lp-reveal" style={{ marginTop: 68 }}>
        <Eyebrow>É aqui que tudo se conecta</Eyebrow>
        <H2>O que nenhuma outra plataforma conecta.</H2>
        <P>
          Depois de organizar toda a operação do consultório, a Audere conecta cada
          atendimento numa memória clínica longitudinal — é isso que transforma
          registros isolados em continuidade terapêutica.
        </P>

        <ConvergenceLayer />

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, fontStyle: 'italic',
          color: '#291860', lineHeight: 1.4, textAlign: 'center', maxWidth: 720, margin: '34px auto 0',
        }}>
          A tecnologia cuida do contexto.{' '}
          <span style={{ fontStyle: 'normal', fontWeight: 500 }}>O psicólogo cuida da pessoa.</span>
        </p>
      </div>
    </section>
  )
}


// ─── Bloco 9 — Privacidade ─────────────────────────────────────────────

function Privacidade() {
  return (
    <section id="privacidade" style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(90,158,138,.04) 50%, var(--page))',
      borderTop: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Figura src="/landing/figura-3.png" opacity={0.55} className="lp-float slow"
        style={{ left: '-2%', top: '8%', width: 'min(280px, 28%)', height: '74%', zIndex: 0 }} />
      <div className="lp-wrap lp-reveal" style={{ position: 'relative', zIndex: 1 }}>
        <Eyebrow>Privacidade por design</Eyebrow>
        <H2>Seus dados de paciente:<br />blindados em todas as camadas.</H2>
        <P>
          Construído com LGPD, CFP 09/2024 e CFP 11/2018 como base — não como
          checklist no fim do projeto.
        </P>

        <div className="lp-grid-2" style={{ marginTop: 36, alignItems: 'start' }}>
          <div style={{ padding: '6px 22px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <ChkRow
              titulo="AES-256-GCM em repouso · TLS 1.3 em trânsito"
              corpo="Transcrições, resumos e notas clínicas criptografados. A chave não é acessível pelo painel — só pelo runtime do servidor."
            />
            <ChkRow
              titulo="Áudio descartado imediatamente"
              corpo="Processado para transcrição e deletado em segundos. Nada de vídeo é gravado. Só a transcrição textual (criptografada) persiste."
            />
            <ChkRow
              titulo="Zero data training — cláusula com a Anthropic"
              corpo="Seus dados não treinam nenhum modelo. Explícito no termo do paciente e auditável a qualquer momento."
            />
            <ChkRow
              titulo="Consentimento granular registrado"
              corpo="Termos CFP 11/2018, CFP 09/2024 e LGPD — assinados com IP e timestamp automáticos."
            />
            <ChkRow
              titulo="Pagamentos com padrão bancário"
              corpo="Processamento certificado PCI DSS Nível 1 — com criptografia, antifraude, autenticação 3DS 2.0 e tokenização de cartão. Em conformidade com o Banco Central."
            />
            <ChkRow
              titulo="Audere não toca seu dinheiro"
              corpo="O que seus pacientes pagam cai direto na sua conta, por processamento de pagamento certificado e independente do Audere."
            />
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <NotaCard rotulo="A Audere observa · você decide">
              Toda sugestão usa linguagem observacional — frequência, padrão,
              co-ocorrência. Há uma camada de validação que segura o texto se ele
              escapar pro território de interpretação. A decisão terapêutica é sempre sua.
            </NotaCard>
            <NotaCard rotulo="Sempre rascunho">
              Resumos, observações e marcações ficam pra você revisar. Nenhuma nota
              vira prontuário sem a sua leitura e assinatura.
            </NotaCard>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChkRow({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: 'rgba(90,158,138,.14)', color: 'var(--sage)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
      }}>✓</span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: '#2a6456', marginBottom: 3 }}>{titulo}</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>{corpo}</p>
      </div>
    </div>
  )
}

// ─── Bloco 10 — Manifesto (seção visual própria) ───────────────────────

function Manifesto() {
  const linhas = [
    'A Audere age muito, aparece pouco.',
    'Observação. Nunca diagnóstico.',
    'Rascunho até você assinar.',
    'A tecnologia cuida do contexto. O psicólogo cuida da pessoa.',
    'O cuidado continua humano.',
  ]
  return (
    <section style={{
      padding: '88px 0',
      background: 'linear-gradient(135deg, rgba(106,78,200,.08), rgba(90,158,138,.08))',
      borderTop: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Figura src="/landing/figura-3.png" opacity={0.5} className="lp-float"
        style={{ left: '-3%', top: '10%', width: 'min(260px, 26%)', height: '70%', zIndex: 0 }} />
      <div className="lp-wrap lp-reveal" style={{ maxWidth: 760, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Eyebrow>Manifesto Audere</Eyebrow>
        <div style={{ display: 'grid', gap: 16, marginTop: 26 }}>
          {linhas.map((l, i) => (
            <p key={i} style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 300,
              fontStyle: 'italic',
              color: i === linhas.length - 1 ? '#291860' : 'var(--ink-soft)',
              lineHeight: 1.32, margin: 0, letterSpacing: '-.01em',
            }}>
              {l}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Bloco 11 — Prova social (sem números inventados) ──────────────────

function ProvaSocial() {
  const itens = [
    { t: 'Desenvolvido junto a psicólogos brasileiros', c: 'Cada decisão de produto nasce da prática clínica real — não de um genérico de software.' },
    { t: 'Construído sobre CFP 09/2024, CFP 11/2018 e LGPD', c: 'Ética e privacidade são a fundação, não um adendo. Linguagem observacional, nunca diagnóstica.' },
    { t: 'Beta por convite, acompanhado de perto', c: 'Abrimos acesso em ondas pequenas para acompanhar cada conta na fase inicial.' },
  ]
  return (
    <section style={{ padding: '72px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap lp-reveal">
        <Eyebrow>Por que confiar</Eyebrow>
        <H2>Feito com psicólogos, para psicólogos.</H2>
        <div className="lp-grid-3" style={{ marginTop: 32 }}>
          {itens.map((it, i) => (
            <div key={i} style={{
              padding: 24, borderRadius: 14,
              background: 'var(--card)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 8 }}>{it.t}</div>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{it.c}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA final ─────────────────────────────────────────────────────────

function CtaFinal() {
  return (
    <section id="acesso" style={{
      padding: '80px 0', borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      {/* Fecho — verdade simples que bookenda "A memória humana não [acompanha]" */}
      <div className="lp-wrap lp-reveal" style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 60px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4.4vw,48px)', fontWeight: 300,
          fontStyle: 'italic', color: '#291860', lineHeight: 1.18, letterSpacing: '-.012em', margin: 0,
        }}>
          A memória se perde.<br />
          <span style={{ fontStyle: 'normal', fontWeight: 500 }}>A continuidade, não.</span>
        </p>
      </div>

      <div className="lp-wrap lp-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div>
          <Eyebrow>Acesso antecipado</Eyebrow>
          <H2>Participe do programa beta.</H2>
          <P>
            Estamos abrindo acesso por convite, em ondas pequenas, pra acompanhar
            cada conta de perto durante a fase inicial. Deixe seu email — avisamos
            quando seu acesso abrir.
          </P>
          <P style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
            Sem fidelidade, sem mensalidade durante o beta.
          </P>
        </div>

        <div style={{
          padding: 28, borderRadius: 16,
          background: 'var(--card)', border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(26,24,37,.06)',
        }}>
          <ListaEsperaForm />
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────

function FooterLanding() {
  return (
    <footer style={{
      padding: '40px 0 32px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div className="lp-wrap lp-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        <div>
          <Logo size={28} />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.55, maxWidth: 340 }}>
            A primeira plataforma de Inteligência Clínica Longitudinal do Brasil.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)', alignItems: 'flex-end' }}>
          <a href="/login" className="lp-link">Já tenho conta</a>
          <a href="mailto:contato@automaxia.com.br" className="lp-link">contato@automaxia.com.br</a>
          <span style={{ color: 'var(--faint)' }}>© Audere · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Tokens visuais auxiliares ─────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--accent)',
      textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 500,
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300,
      color: '#291860', lineHeight: 1.15, letterSpacing: '-.01em',
      margin: '0 0 18px',
    }}>{children}</h2>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.65, margin: 0, maxWidth: 640, ...style }}>
      {children}
    </p>
  )
}

// ─── CSS scoped ────────────────────────────────────────────────────────

function Styles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .lp-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

      /* Animações — revela ao rolar (fade + sobe + leve zoom) e flutua nas figuras. */
      .lp-reveal { opacity: 0; transform: translateY(36px) scale(.98); transition: opacity .7s var(--ease), transform .8s cubic-bezier(.2,.75,.2,1); will-change: opacity, transform; }
      .lp-reveal.in { opacity: 1; transform: none; }
      @keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-26px); } }
      .lp-float { animation: lp-float 7s ease-in-out infinite; }
      .lp-float.slow { animation-duration: 10s; }
      /* Ken-burns no fundo do herói (scale ≥1.06 sempre cobre, sem brechas). */
      @keyframes lp-kenburns { 0% { transform: scale(1.06) translate(0, 0); } 100% { transform: scale(1.2) translate(-3%, -2%); } }
      .lp-kenburns { animation: lp-kenburns 17s ease-in-out infinite alternate; transform-origin: 50% 45%; will-change: transform; }
      @media (prefers-reduced-motion: reduce) {
        .lp-reveal { opacity: 1 !important; transform: none !important; transition: none; }
        .lp-float, .lp-kenburns { animation: none !important; }
      }

      .lp-link { color: var(--ink-soft); text-decoration: none; transition: color .15s var(--ease); }
      .lp-link:hover { color: var(--accent); }

      .lp-btn-primary {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 14px 24px; border-radius: 999px;
        background: var(--accent); color: white;
        font-size: 14px; font-weight: 500; text-decoration: none;
        transition: background .2s var(--ease), transform .2s var(--ease);
      }
      .lp-btn-primary:hover { background: #5a40b0; transform: translateY(-1px); }

      .lp-btn-ghost {
        display: inline-flex; align-items: center;
        padding: 14px 24px; border-radius: 999px;
        background: transparent; color: var(--ink-soft);
        border: 1px solid var(--border);
        font-size: 14px; font-weight: 500; text-decoration: none;
        transition: all .2s var(--ease);
      }
      .lp-btn-ghost:hover { background: var(--card); border-color: var(--accent); color: var(--accent); }

      .lp-grid-2 { display: grid; gap: 18px; grid-template-columns: 1fr 1fr; }
      .lp-grid-3 { display: grid; gap: 18px; grid-template-columns: repeat(3, 1fr); }

      /* Cadeia da continuidade — pills + setas */
      .lp-chain {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
        gap: 10px 8px;
      }
      .lp-chain-pill {
        padding: 11px 20px; border-radius: 999px;
        background: var(--card); border: 1px solid var(--border);
        font-family: var(--font-display), serif; font-size: 17px; color: #291860;
        white-space: nowrap;
      }
      .lp-chain-arrow { color: var(--accent); font-size: 18px; }

      @media (max-width: 900px) {
        .lp-wrap[style*="1fr 1fr"],
        .lp-wrap [style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
        .lp-grid-2, .lp-grid-3 { grid-template-columns: 1fr; }
        h1 { font-size: 38px !important; }
        h2 { font-size: 30px !important; }
        .lp-chain { flex-direction: column; }
        .lp-chain-arrow { transform: rotate(90deg); }
      }
    ` }} />
  )
}
