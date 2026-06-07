import { Logo } from '@/components/brand/Logo'
import { ListaEsperaForm } from './ListaEsperaForm'

export const dynamic = 'force-dynamic'

export default function LancamentoPage() {
  return (
    <div style={{ background: 'var(--page)', color: 'var(--ink)', overflowX: 'hidden' }}>
      <NavTopo />
      <Hero />
      {/* Lidera com o diferenciador (memória/continuidade), depois a sessão e a
          operação. Ética e privacidade ficam pro fim — pra quem já se interessou. */}
      <Continuidade />
      <ModoPresenca />
      <PraticaIntegrada />
      <Privacidade />
      <Manifesto />
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
        <nav style={{ display: 'flex', gap: 22, fontSize: 13 }}>
          <a href="#continuidade" className="lp-link">Continuidade</a>
          <a href="#presenca"     className="lp-link">Sessão</a>
          <a href="#gestao"       className="lp-link">Gestão</a>
          <a href="#privacidade"  className="lp-link">Privacidade</a>
          <a href="#lista"        className="lp-link" style={{ color: 'var(--accent)' }}>Lista de espera</a>
        </nav>
      </div>
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ padding: '88px 0 64px', position: 'relative' }}>
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28, textAlign: 'center', maxWidth: 820 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300,
          color: '#291860', lineHeight: 1.08, letterSpacing: '-.01em',
          margin: '8px 0',
        }}>
          Sua assistente de clínica com{' '}
          <em style={{
            fontStyle: 'italic',
            background: 'linear-gradient(90deg, #6a4ec8, #5c9d88)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>memória.</em>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.55,
          maxWidth: 640, margin: '0 auto',
        }}>
          Agenda, pagamentos, sala de vídeo e transcrição — todos integrados. E um
          mapa vivo do processo terapêutico que cresce sessão a sessão.{' '}
          <strong>A Audere organiza, observa e sugere — a decisão clínica é sempre sua.</strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6 }}>
          <a href="#lista" className="lp-btn-primary">
            Entrar na lista de espera →
          </a>
          <a href="#continuidade" className="lp-btn-ghost">
            Como funciona
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          Beta por convite · vagas limitadas · sem mensalidade durante o beta
        </p>
      </div>
    </section>
  )
}

// ─── Continuidade longitudinal (1ª seção de produto · o diferenciador) ──

function Continuidade() {
  return (
    <section id="continuidade" style={{
      padding: '80px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>Entre uma sessão e outra</Eyebrow>
        <H2>Continuidade longitudinal.</H2>
        <P>
          Em vez de relembrar à mão o que aconteceu três semanas atrás, a Audere
          mantém um mapa vivo do processo clínico — pra você abrir antes da sessão e ver de onde
          retomar.
        </P>

        <div className="lp-grid-3" style={{ marginTop: 36 }}>
          <FeatCard
            titulo="Temas Recorrentes"
            corpo="Grafo de palavras-chave por cluster (emocional, relacional, situacional, cognitivo) construído a partir das transcrições. Co-ocorrências mostram quais temas aparecem juntos ao longo do processo."
            tag="grafo"
          />
          <FeatCard
            titulo="Objetivos SMART"
            corpo="Cada objetivo terapêutico tem métrica, baseline, alvo e prazo. Suporta GAS (Goal Attainment Scaling) para metas subjetivas. Bullet chart mostra a posição atual em relação ao alvo."
            tag="bullet chart"
          />
          <FeatCard
            titulo="Evolução Registrada"
            corpo="Painel longitudinal com humor, ritmo, frequência de presença e abertura ao longo do tempo. Marcos do processo extraídos automaticamente das sessões anteriores."
            tag="histórico"
          />
        </div>

        <GrafoDemo />
      </div>
    </section>
  )
}

function GrafoDemo() {
  // Nós = temas (cor por cluster, raio por frequência). Coords em viewBox 340×220.
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
      {/* Grafo */}
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
                fill="var(--ink-soft)" fontFamily="var(--font-display), serif">{n.id}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Valor pro psicólogo */}
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

// ─── Modo Presença (a sessão) ──────────────────────────────────────────

function ModoPresenca() {
  return (
    <section id="presenca" style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(106,78,200,.04) 60%, var(--page))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>Durante a sessão</Eyebrow>
        <H2>A ferramenta que se ajusta<br />à sua prática — não o contrário.</H2>
        <P>
          Como um GPS que calcula a rota enquanto você dirige — as informações
          estão disponíveis quando você quer, invisíveis quando não quer. Painéis
          reposicionáveis, ou desligados por completo.
        </P>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start', marginTop: 36 }}>
          <PresencaMockup />

          <div style={{ display: 'grid', gap: 12 }}>
            <NotaCard rotulo="Ritmo de fala — por que importa">
              Estudos em psicoterapia mostram que, quando o paciente fala a maior
              parte do tempo, costuma haver descoberta guiada — conclusões chegando
              por caminhos próprios, vínculo sendo construído. Proporção invertida
              por longos trechos merece atenção.
            </NotaCard>
            <NotaCard rotulo="Temas ao vivo + histórico">
              Quando &ldquo;sumir&rdquo; aparece na sessão de hoje, a Audere já sabe
              que surgiu nas sessões 4 e 7. Você não precisa lembrar — está visível,
              com o contexto de quando e como apareceu antes.
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

// ─── Prática integrada (gestão) ────────────────────────────────────────

function PraticaIntegrada() {
  return (
    <section id="gestao" style={{
      padding: '80px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>O outro lado da prática</Eyebrow>
        <H2>Tudo que sustenta o consultório,<br />numa só interface.</H2>
        <P>
          Sem alternar entre sistemas que não conversam entre si. Agenda,
          pagamentos, WhatsApp e vídeo — no mesmo lugar onde a inteligência clínica vive.
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
            corpo="PIX, crédito e débito em ambiente seguro — para as sessões que seus pacientes pagam e para o seu acesso ao Audere. O valor das sessões cai direto na sua conta."
          />
          <BlocoOperacional
            icone="◐"
            titulo="WhatsApp como interface do paciente"
            corpo="O paciente nunca instala nada. Confirmações, pagamento, lembretes e pós-sessão pelo WhatsApp. Você acompanha num único painel."
          />
          <BlocoOperacional
            icone="▶"
            titulo="Sala de vídeo embutida"
            corpo="Atendimento online com termo CFP 11/2018. Link gerado por sessão, válido por 4h. Áudio processado — vídeo nunca gravado."
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

// ─── Privacidade e ética (penúltima · pra quem já se interessou) ────────

function Privacidade() {
  return (
    <section id="privacidade" style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(90,158,138,.04) 50%, var(--page))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>Privacidade por design</Eyebrow>
        <H2>Seus dados de paciente:<br />blindados em todas as camadas.</H2>
        <P>
          Construído com LGPD, CFP 09/2024 e CFP 11/2018 como base — não como
          checklist no fim do projeto.
        </P>

        <div className="lp-grid-2" style={{ marginTop: 36, alignItems: 'start' }}>
          {/* Camadas técnicas */}
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
              corpo="Processamento certificado PCI DSS Nível 1 — o mais alto padrão de segurança — com criptografia, antifraude, autenticação 3DS 2.0 e tokenização de cartão. Em conformidade com o Banco Central."
            />
            <ChkRow
              titulo="Audere não toca seu dinheiro"
              corpo="O que seus pacientes pagam cai direto na sua conta, por processamento de pagamento certificado e independente do Audere. Um problema no Audere não afeta o seu recebimento."
            />
          </div>

          {/* Ética da IA — dissolvida aqui, no fim, em vez de no topo */}
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

// ─── Manifesto (fechamento emocional, compacto, antes do form) ─────────

function Manifesto() {
  const linhas = [
    'A Audere age muito, aparece pouco.',
    'Presente, não gravando.',
    'Frequência e observação, nunca diagnóstico.',
    'Rascunho até você assinar.',
    'Você é a(o) psicóloga(o). Audere é seu sistema.',
  ]
  return (
    <section style={{
      padding: '64px 0',
      background: 'linear-gradient(135deg, rgba(106,78,200,.06), rgba(90,158,138,.06))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{ maxWidth: 720, textAlign: 'center' }}>
        <Eyebrow>Manifesto · resumo em cinco linhas</Eyebrow>
        <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
          {linhas.map((l, i) => (
            <p key={i} style={{
              fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 300,
              fontStyle: 'italic',
              color: i === linhas.length - 1 ? '#291860' : 'var(--ink-soft)',
              lineHeight: 1.35, margin: 0, letterSpacing: '-.01em',
            }}>
              {l}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA final ─────────────────────────────────────────────────────────

function CtaFinal() {
  return (
    <section id="lista" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div>
          <Eyebrow>Acesso antecipado</Eyebrow>
          <H2>Entre na lista de espera.</H2>
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
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.55, maxWidth: 320 }}>
            Sistema operacional da prática clínica.
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

      @media (max-width: 900px) {
        .lp-wrap > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        .lp-grid-2, .lp-grid-3 { grid-template-columns: 1fr; }
        h1 { font-size: 38px !important; }
        h2 { font-size: 30px !important; }
      }
    ` }} />
  )
}
