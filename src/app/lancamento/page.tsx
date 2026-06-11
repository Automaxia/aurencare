import { Logo } from '@/components/brand/Logo'
import { ListaEsperaForm } from './ListaEsperaForm'

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
      <OQueEContinuidade />
      <LembraPorVoce />
      <ContinuidadeLongitudinal />
      <AcompanheEvolucao />
      <ModoPresenca />
      <PraticaIntegrada />
      <Privacidade />
      <Manifesto />
      <ProvaSocial />
      <CtaFinal />
      <FooterLanding />
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

function Figura({ src, style, opacity = 1 }: {
  src: string; style?: React.CSSProperties; opacity?: number
}) {
  return (
    <div aria-hidden style={{
      position: 'absolute', pointerEvents: 'none',
      backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain', backgroundPosition: 'center',
      opacity, mixBlendMode: 'multiply',
      ...style,
    }} />
  )
}

// ─── Hero — posicionamento de categoria ────────────────────────────────

function Hero() {
  return (
    <section style={{
      minHeight: 'calc(100vh - 54px)', display: 'grid', placeItems: 'center',
      position: 'relative', overflow: 'hidden', padding: '48px 0',
      backgroundColor: 'var(--page)',
      backgroundImage: 'url(/landing/conversa.png)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 62% 68% at 50% 48%, rgba(249,248,245,.93) 0%, rgba(249,248,245,.64) 40%, rgba(249,248,245,0) 73%)',
      }} />
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 26, textAlign: 'center', maxWidth: 860, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase',
          letterSpacing: '.16em', fontWeight: 600,
        }}>
          Continuidade Terapêutica
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300,
          color: '#291860', lineHeight: 1.08, letterSpacing: '-.015em',
          margin: '4px 0',
        }}>
          A primeira plataforma de{' '}
          <em style={{
            fontStyle: 'italic',
            background: 'linear-gradient(90deg, #6a4ec8, #5c9d88)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Continuidade Terapêutica</em>{' '}
          do Brasil.
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.55,
          maxWidth: 660, margin: '0 auto',
        }}>
          A Audere organiza, acompanha e conecta tudo o que acontece entre uma
          sessão e outra — para que você <strong>nunca precise reconstruir sozinho a
          história de um paciente.</strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <a href="#acesso" className="lp-btn-primary">
            Solicitar acesso antecipado →
          </a>
          <a href="#observar" className="lp-btn-ghost">
            O que a Audere lembra por você
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          Beta por convite · vagas limitadas · sem mensalidade durante o beta
        </p>
      </div>
    </section>
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
      <div className="lp-wrap" style={{ maxWidth: 760 }}>
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

// ─── Bloco 2 — O que é Continuidade Terapêutica (a cadeia) ─────────────

function OQueEContinuidade() {
  const etapas = ['Sessões', 'Temas', 'Objetivos', 'Evolução', 'Memória Clínica']
  return (
    <section style={{
      padding: '80px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>O que a Audere faz é diferente</Eyebrow>
        <H2>A maioria dos sistemas organiza agenda.<br />A Audere organiza continuidade.</H2>
        <P>
          Ela conecta tudo o que acontece ao longo do processo numa única linha do
          tempo terapêutica — em vez de deixar cada peça num lugar diferente.
        </P>

        <div className="lp-chain" style={{ marginTop: 40 }}>
          {etapas.map((e, i) => (
            <span key={e} style={{ display: 'contents' }}>
              <span className="lp-chain-pill">{e}</span>
              {i < etapas.length - 1 && <span className="lp-chain-arrow" aria-hidden>→</span>}
            </span>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginTop: 22 }}>
          Tudo dentro de uma única linha do tempo terapêutica.
        </p>
      </div>
    </section>
  )
}

// ─── Bloco 3 — O que a Audere lembra por você ──────────────────────────

function LembraPorVoce() {
  const obs = [
    'Cobrança apareceu em 8 sessões.',
    'Ansiedade costuma surgir associada ao trabalho.',
    'O objetivo de autoestima evoluiu 60%.',
    'Paciente mencionou a mãe em 12 sessões.',
    'O tema sono desapareceu nas últimas 5 sessões.',
  ]
  return (
    <section id="observar" style={{
      padding: '80px 0', borderTop: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="lp-wrap">
        <Eyebrow>Memória clínica longitudinal</Eyebrow>
        <H2>O que a Audere lembra por você.</H2>
        <P>
          Observações factuais que emergem do próprio histórico — disponíveis num
          olhar, antes da sessão começar.
        </P>

        <div className="lp-grid-3" style={{ marginTop: 36 }}>
          {obs.map((o, i) => (
            <div key={i} style={{
              padding: 24, borderRadius: 14,
              background: 'var(--card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>◍</span>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400,
                color: 'var(--ink)', lineHeight: 1.4, margin: 0,
              }}>
                &ldquo;{o}&rdquo;
              </p>
            </div>
          ))}
          <div style={{
            padding: 24, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(106,78,200,.07), rgba(90,158,138,.07))',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
              A Audere <strong>não interpreta</strong>. Apenas ajuda você a observar — frequência,
              padrão, co-ocorrência. A leitura clínica é sempre sua.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Bloco 4 — Continuidade longitudinal (grafo · protagonista) ────────

function ContinuidadeLongitudinal() {
  return (
    <section id="continuidade" style={{
      padding: '80px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Figura src="/landing/figura-1.png" opacity={0.6}
        style={{ left: '-2%', bottom: '-4%', width: 'min(300px, 30%)', height: '78%', zIndex: 0 }} />
      <div className="lp-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <Eyebrow>O diferencial competitivo</Eyebrow>
        <H2>Sessões viram conhecimento estruturado.</H2>
        <P>
          Cada sessão alimenta um mapa vivo do processo. Temas Recorrentes mostram
          o que se conecta com o quê ao longo do tempo — o caso inteiro num olhar,
          não perdido em meses de anotação.
        </P>

        <GrafoDemo />
      </div>
    </section>
  )
}

function GrafoDemo() {
  const nodes = [
    { id: 'ansiedade',  x: 152, y: 112, r: 27, cor: '#6a4ec8' },
    { id: 'cobrança',   x: 256, y: 64,  r: 20, cor: '#b07d40' },
    { id: 'trabalho',   x: 84,  y: 48,  r: 18, cor: '#5a9e8a' },
    { id: 'autoestima', x: 252, y: 170, r: 18, cor: '#b07d40' },
    { id: 'sono',       x: 92,  y: 182, r: 15, cor: '#5a9e8a' },
    { id: 'mãe',        x: 36,  y: 122, r: 14, cor: '#c4607a' },
    { id: 'sumir',      x: 210, y: 26,  r: 12, cor: '#6a4ec8' },
  ]
  const pos: Record<string, { x: number; y: number; r: number; cor: string }> =
    Object.fromEntries(nodes.map(n => [n.id, n]))
  const edges: [string, string, number][] = [
    ['ansiedade', 'cobrança', .7], ['ansiedade', 'trabalho', .5], ['ansiedade', 'sono', .45],
    ['ansiedade', 'sumir', .4], ['ansiedade', 'mãe', .35],
    ['cobrança', 'autoestima', .6], ['mãe', 'autoestima', .55], ['trabalho', 'cobrança', .4],
  ]
  return (
    <div style={{
      marginTop: 24, padding: 22, borderRadius: 14,
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center',
    }}>
      <div style={{ flex: '1 1 300px', minWidth: 280 }}>
        <div style={{
          fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase',
          letterSpacing: '.08em', fontFamily: 'var(--font-mono), monospace', marginBottom: 12,
        }}>Grafo de temas · Marina · 14 sessões</div>
        <svg viewBox="0 0 340 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {edges.map(([a, b, w], i) => (
            <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y}
              stroke="#6a4ec8" strokeOpacity={0.12 + w * 0.2} strokeWidth={1 + w * 1.6} />
          ))}
          {nodes.map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.cor} fillOpacity={0.85} />
              <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fontSize="10"
                fill="var(--ink-soft, #3d3852)" fontFamily="var(--font-display), serif">{n.id}</text>
            </g>
          ))}
        </svg>
      </div>

      <div style={{ flex: '1 1 240px', minWidth: 220 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
          Cada tema vira um <strong>nó</strong> — quanto mais aparece nas sessões, maior.
          As <strong>linhas</strong> mostram o que costuma surgir junto.
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          <ValorItem>Abra <strong>antes da sessão</strong> e veja o caso inteiro num olhar.</ValorItem>
          <ValorItem>&ldquo;Cobrança&rdquo; puxando &ldquo;ansiedade&rdquo; e &ldquo;autoestima&rdquo;: o padrão fica <strong>visível</strong>, não perdido em meses de anotação.</ValorItem>
          <ValorItem>As cores agrupam por natureza — emocional, relacional, situacional, cognitivo.</ValorItem>
        </ul>
      </div>
    </div>
  )
}

function ValorItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
      <span style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>◍</span>
      <span>{children}</span>
    </li>
  )
}

// ─── Bloco 5+6 — Objetivos + Evolução (acompanhar ao longo do tempo) ───

function AcompanheEvolucao() {
  return (
    <section style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(106,78,200,.04) 60%, var(--page))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>Ao longo do tempo</Eyebrow>
        <H2>Você finalmente acompanha a evolução —<br />não apenas registra sessões.</H2>

        <div className="lp-grid-2" style={{ marginTop: 36 }}>
          <FeatCard
            tag="objetivos · SMART + GAS"
            titulo="Objetivos Terapêuticos"
            corpo="Cada objetivo tem métrica, baseline, alvo e prazo — com suporte a GAS (Goal Attainment Scaling) para metas subjetivas. O bullet chart mostra a posição atual em relação ao alvo, sessão após sessão. Acompanhar evolução, não só anotar a intenção."
          />
          <FeatCard
            tag="evolução · longitudinal"
            titulo="Evolução Registrada"
            corpo="Um painel longitudinal acompanha humor, ritmo, presença e abertura ao longo do processo. Marcos são extraídos automaticamente das sessões anteriores. A Audere acompanha as mudanças — não apenas guarda o registro."
          />
        </div>
      </div>
    </section>
  )
}

function FeatCard({ titulo, corpo, tag }: { titulo: string; corpo: string; tag: string }) {
  return (
    <div style={{
      padding: 26, borderRadius: 14,
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'grid', gap: 12,
    }}>
      <div style={{
        fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase',
        letterSpacing: '.08em', fontFamily: 'var(--font-mono), monospace',
      }}>{tag}</div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: 0,
        color: 'var(--ink)',
      }}>{titulo}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{corpo}</p>
    </div>
  )
}

// ─── Bloco 7 — Durante a sessão (reduzido) ─────────────────────────────

function ModoPresenca() {
  return (
    <section id="sessao" style={{
      padding: '72px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="lp-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <Eyebrow>Durante a sessão</Eyebrow>
        <H2>E quando a sessão começa,<br />o contexto já está com você.</H2>
        <P>
          O registro acontece sozinho. Quando um tema reaparece, a Audere já sabe
          quando surgiu antes. As informações ficam disponíveis quando você quer,
          invisíveis quando não quer — painéis reposicionáveis, ou desligados.
        </P>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start', marginTop: 36 }}>
          <PresencaMockup />

          <div style={{ display: 'grid', gap: 12 }}>
            <NotaCard rotulo="Temas ao vivo + histórico">
              Quando &ldquo;sumir&rdquo; aparece na sessão de hoje, a Audere já sabe
              que surgiu nas sessões 4 e 7. Você não precisa lembrar — está visível,
              com o contexto de quando e como apareceu antes.
            </NotaCard>
            <NotaCard rotulo="Ritmo de fala">
              Quando o paciente fala a maior parte do tempo, costuma haver descoberta
              guiada. Proporção invertida por longos trechos merece atenção — a Audere
              mostra, você lê.
            </NotaCard>
            <NotaCard rotulo="Marcação manual">
              Um botão marca o instante com uma categoria — insight, avanço, ponto a
              revisar. Fica na transcrição pra análise depois.
            </NotaCard>
          </div>
        </div>
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

function PresencaMockup() {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 18, boxShadow: '0 20px 60px rgba(26,24,37,.08)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 10,
        background: 'var(--surface)', marginBottom: 16, fontSize: 12,
      }}>
        <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Fernanda K. · Sessão 7 · 18:42</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sage)', fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)' }} />
          Presente
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <MiniTurno who="P" texto="Como você se sentiu na semana?" />
          <MiniTurno who="C" texto="Foi difícil. Voltou a vontade de sumir." mark="atencao" />
          <MiniTurno who="P" texto="Quando isso voltou?" />
          <MiniTurno who="C" texto="Depois da reunião de quinta." />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Widget titulo="Ritmo">
            <BarRitmo />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>você 62%</div>
          </Widget>
          <Widget titulo="Temas">
            <Temazinhos />
          </Widget>
          <Widget titulo="Risco">
            <RiscoMini />
          </Widget>
        </div>
      </div>
    </div>
  )
}

function MiniTurno({ who, texto, mark }: { who: 'P' | 'C'; texto: string; mark?: 'atencao' }) {
  return (
    <div style={{
      padding: '6px 9px', borderRadius: 6,
      background: 'var(--surface)',
      borderLeft: mark === 'atencao' ? '2.5px solid var(--rose)' : undefined,
      fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.4,
    }}>
      <span style={{ fontWeight: 600, color: who === 'P' ? 'var(--accent)' : 'var(--sage)', marginRight: 5 }}>{who}:</span>
      {texto}
    </div>
  )
}

function Widget({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 8, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{titulo}</div>
      {children}
    </div>
  )
}

function BarRitmo() {
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ width: '62%', background: 'var(--accent)', opacity: .7 }} />
      <div style={{ width: '38%', background: 'var(--sage)', opacity: .7 }} />
    </div>
  )
}
function Temazinhos() {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {['trabalho', 'cansaço', 'mãe', 'sumir'].map(t => (
        <span key={t} style={{
          padding: '2px 7px', borderRadius: 999,
          background: 'rgba(106,78,200,.10)', color: 'var(--accent)',
          fontSize: 9, fontWeight: 500,
        }}>{t}</span>
      ))}
    </div>
  )
}
function RiscoMini() {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
      <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(168,120,64,.13)', color: '#7a5520' }}>ideação · médio</span>
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
      <div className="lp-wrap">
        <Eyebrow>Infraestrutura da prática</Eyebrow>
        <H2>Operar o consultório já vem incluído.</H2>
        <P>
          Agenda, pagamentos, WhatsApp e vídeo estão integrados — não como o
          diferencial, mas como a base que sustenta a prática. Tudo no mesmo lugar
          onde a continuidade clínica vive.
        </P>

        <div className="lp-grid-2" style={{ marginTop: 36 }}>
          <BlocoOperacional
            icone="◷"
            titulo="Agenda"
            corpo="Sessões avulsas e séries recorrentes. Visões de dia, semana e mês. Conflitos detectados antes do envio."
          />
          <BlocoOperacional
            icone="◑"
            titulo="Pagamentos seguros"
            corpo="PIX, crédito e débito em ambiente seguro. O valor das sessões cai direto na sua conta."
          />
          <BlocoOperacional
            icone="◐"
            titulo="WhatsApp como interface do paciente"
            corpo="O paciente nunca instala nada. Confirmações, pagamento, lembretes e pós-sessão pelo WhatsApp. Você acompanha num único painel."
          />
          <BlocoOperacional
            icone="▶"
            titulo="Sala de vídeo embutida"
            corpo="Atendimento online com termo CFP 11/2018. Link por sessão, válido por 4h. Áudio processado — vídeo nunca gravado."
          />
        </div>
      </div>
    </section>
  )
}

function BlocoOperacional({ icone, titulo, corpo }: { icone: string; titulo: string; corpo: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 1fr', gap: 18,
      padding: 24, borderRadius: 14,
      background: 'var(--card)', border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'rgba(106,78,200,.10)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>{icone}</div>
      <div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400,
          margin: '0 0 6px', color: 'var(--ink)',
        }}>{titulo}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{corpo}</p>
      </div>
    </div>
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
      <Figura src="/landing/figura-3.png" opacity={0.55}
        style={{ left: '-2%', top: '8%', width: 'min(280px, 28%)', height: '74%', zIndex: 0 }} />
      <div className="lp-wrap" style={{ position: 'relative', zIndex: 1 }}>
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
    'Você decide. A tecnologia apoia.',
    'O cuidado continua humano.',
  ]
  return (
    <section style={{
      padding: '88px 0',
      background: 'linear-gradient(135deg, rgba(106,78,200,.08), rgba(90,158,138,.08))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{ maxWidth: 760, textAlign: 'center' }}>
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
      <div className="lp-wrap">
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
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
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
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        <div>
          <Logo size={28} />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.55, maxWidth: 340 }}>
            A primeira plataforma de Continuidade Terapêutica do Brasil.
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
