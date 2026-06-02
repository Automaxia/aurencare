import { Logo } from '@/components/brand/Logo'
import { contarListaEspera } from '@/server/services/listaEspera'
import { ListaEsperaForm } from './ListaEsperaForm'

export const dynamic = 'force-dynamic'

export default async function LancamentoPage() {
  const totalLista = await contarListaEspera()

  return (
    <div style={{ background: 'var(--page)', color: 'var(--ink)', overflowX: 'hidden' }}>
      <NavTopo />
      <Hero totalLista={totalLista} />
      <PrincipioFundador />
      <ModoPresenca />
      <Continuidade />
      <PraticaIntegrada />
      <ProtecaoMutua />
      <Privacidade />
      <ParaQuem />
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
          <a href="#principio"   className="lp-link">Princípio</a>
          <a href="#presenca"    className="lp-link">Modo Presença</a>
          <a href="#privacidade" className="lp-link">Privacidade</a>
          <a href="#lista"       className="lp-link" style={{ color: 'var(--accent)' }}>Lista de espera</a>
        </nav>
      </div>
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────

function Hero({ totalLista }: { totalLista: number }) {
  return (
    <section style={{ padding: '88px 0 64px', position: 'relative' }}>
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28, textAlign: 'center', maxWidth: 820 }}>
        <CfpPill />

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 300,
          color: '#291860', lineHeight: 1.08, letterSpacing: '-.01em',
          margin: '8px 0',
        }}>
          A IA que sabe seu lugar —<br />
          <em style={{
            fontStyle: 'italic',
            background: 'linear-gradient(90deg, #6a4ec8, #5c9d88)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>assistente da sua escuta clínica.</em>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.55,
          maxWidth: 640, margin: '0 auto',
        }}>
          Auren Care é o sistema operacional da prática clínica privada.
          Agenda, pagamentos, sala de vídeo, transcrição em tempo real e
          continuidade longitudinal — todos integrados.
          A inteligência artificial <strong>organiza, observa e sugere</strong> —
          mas <strong>nunca diagnostica, nunca interpreta clinicamente, nunca substitui sua decisão</strong>.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6 }}>
          <a href="#lista" className="lp-btn-primary">
            Entrar na lista de espera →
          </a>
          <a href="#principio" className="lp-btn-ghost">
            Como funciona
          </a>
        </div>

        {totalLista > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            {totalLista} {totalLista === 1 ? 'profissional já está' : 'profissionais já estão'} na lista de espera.
          </p>
        )}
      </div>
    </section>
  )
}

function CfpPill() {
  return (
    <div style={{
      display: 'inline-flex', alignSelf: 'center',
      alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 999,
      background: 'rgba(176,125,64,.10)',
      border: '1px solid rgba(176,125,64,.22)',
      fontSize: 11, color: '#7a5520', letterSpacing: '.04em',
    }}>
      <span style={{ fontSize: 13 }}>🧭</span>
      IA assistente · CFP 09/2024 · LGPD
    </div>
  )
}

// ─── Princípio fundador ────────────────────────────────────────────────

function PrincipioFundador() {
  return (
    <section id="principio" style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap">
        <Eyebrow>O princípio que fundou o produto</Eyebrow>
        <H2>IA não é psicóloga.<br />Você é.</H2>
        <P>
          Toda decisão clínica do Auren passou por uma régua única: <strong>a inteligência
          artificial é apoio de continuidade, nunca substituição de escuta</strong>. Isso aparece
          em três compromissos não-negociáveis.
        </P>

        <div className="lp-grid-3" style={{ marginTop: 36 }}>
          <PrincipioCard
            numero="01"
            titulo="Nunca diagnostica"
            corpo="Toda resposta da IA usa linguagem observacional — frequência, padrão, co-ocorrência, primeira menção. Nada de quadro, transferência ou interpretação. Há uma camada de validação automática que bloqueia o texto se ele escapar."
          />
          <PrincipioCard
            numero="02"
            titulo="Sempre rascunho"
            corpo="Resumos, observações, marcações de risco: tudo aparece pra você revisar e assinar. Nenhuma nota vira prontuário sem sua aprovação. A IA propõe; você decide."
          />
          <PrincipioCard
            numero="03"
            titulo="Zero treinamento"
            corpo="Seus dados clínicos não são usados pra treinar nenhum modelo de IA. Áudio bruto é descartado imediatamente após transcrição. Cláusula contratual com a Anthropic — explícita no termo do paciente."
          />
        </div>
      </div>
    </section>
  )
}

function PrincipioCard({ numero, titulo, corpo }: { numero: string; titulo: string; corpo: string }) {
  return (
    <div style={{
      padding: 28, borderRadius: 16,
      background: 'var(--card)', border: '1px solid var(--border)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono), monospace', fontSize: 11,
        color: 'var(--accent)', marginBottom: 14, letterSpacing: '.1em',
      }}>{numero}</div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400,
        margin: '0 0 12px', color: 'var(--ink)',
      }}>{titulo}</h3>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{corpo}</p>
    </div>
  )
}

// ─── Modo Presença ─────────────────────────────────────────────────────

function ModoPresenca() {
  return (
    <section id="presenca" style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(106,78,200,.04) 60%, var(--page))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <Eyebrow>Durante a sessão</Eyebrow>
          <H2>Modo Presença.<br />A IA fica em silêncio organizando.</H2>
          <P>
            Você abre a sessão e a interface desaparece. Sidebar, topbar — tudo some.
            Resta um espaço limpo pra conversar.
          </P>
          <P style={{ marginTop: 16 }}>
            A inteligência artificial trabalha em segundo plano: transcreve a fala
            de ambos os lados, organiza temas que vão surgindo, mede o ritmo da conversa,
            registra pontos de risco. Quando você precisa, está tudo lá — formatado pra
            revisão depois.
          </P>

          <ul style={{
            margin: '28px 0 0', padding: 0, listStyle: 'none',
            display: 'grid', gap: 14,
          }}>
            <Beneficio>
              <strong>Transcrição com diarização</strong> — quem disse o quê, automaticamente
            </Beneficio>
            <Beneficio>
              <strong>Mini-grafo de temas ao vivo</strong> — palavras se conectam conforme a sessão acontece
            </Beneficio>
            <Beneficio>
              <strong>Ritmo de fala</strong> — quanto você fala, quanto o paciente fala
            </Beneficio>
            <Beneficio>
              <strong>Marcação de turnos</strong> — insight, comportamento-problema, avanço
            </Beneficio>
            <Beneficio>
              <strong>Risco em três dimensões</strong> — autolesão, ideação, plano
            </Beneficio>
          </ul>
        </div>

        <PresencaMockup />
      </div>
    </section>
  )
}

function Beneficio({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(90,158,138,.14)', color: 'var(--sage)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 500, flexShrink: 0, marginTop: 2,
      }}>✓</span>
      <span style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{children}</span>
    </li>
  )
}

function PresencaMockup() {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 18, boxShadow: '0 20px 60px rgba(26,24,37,.08)',
    }}>
      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 10,
        background: 'var(--surface)', marginBottom: 16,
        fontSize: 12,
      }}>
        <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>Fernanda K. · Sessão 7 · 18:42</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--sage)', fontWeight: 500,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)' }} />
          Presente
        </span>
      </div>

      {/* Conteúdo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Transcrição */}
        <div style={{ display: 'grid', gap: 6 }}>
          <MiniTurno who="P" texto="Como você se sentiu na semana?" />
          <MiniTurno who="C" texto="Foi difícil. Voltou a vontade de sumir." mark="atencao" />
          <MiniTurno who="P" texto="Quando isso voltou?" />
          <MiniTurno who="C" texto="Depois da reunião de quinta." />
        </div>
        {/* Widgets */}
        <div style={{ display: 'grid', gap: 8 }}>
          <Widget titulo="Ritmo">
            <BarRitmo />
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
    <div style={{
      padding: 8, borderRadius: 8,
      background: 'var(--card)', border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 9, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5,
      }}>{titulo}</div>
      {children}
    </div>
  )
}

function BarRitmo() {
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ width: '38%', background: 'var(--accent)', opacity: .7 }} />
      <div style={{ width: '62%', background: 'var(--sage)', opacity: .7 }} />
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

// ─── Continuidade clínica ──────────────────────────────────────────────

function Continuidade() {
  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap">
        <Eyebrow>Entre uma sessão e outra</Eyebrow>
        <H2>Continuidade longitudinal.</H2>
        <P>
          Em vez de relembrar à mão o que aconteceu três semanas atrás, o Auren
          mantém um mapa vivo do processo clínico — pra você abrir antes da sessão e ver de onde
          retomar.
        </P>

        <div className="lp-grid-3" style={{ marginTop: 36 }}>
          <FeatCard
            titulo="Temas Recorrentes"
            corpo="Grafo de palavras-chave por cluster (emocional, relacional, situacional, cognitivo) construído a partir das transcrições. Co-ocorrências mostram quais temas aparecem juntos."
            tag="grafo"
          />
          <FeatCard
            titulo="Objetivos SMART"
            corpo="Cada objetivo terapêutico tem métrica, baseline, alvo e prazo. Suporta GAS (Goal Attainment Scaling, -2 a +2) pra metas subjetivas. Bullet chart horizontal mostra a posição atual em relação ao alvo."
            tag="bullet chart"
          />
          <FeatCard
            titulo="Evolução Registrada"
            corpo="Painel longitudinal com humor, ritmo, frequência de presença e abertura ao longo do tempo. Mais marcos do processo extraídos automaticamente das sessões anteriores."
            tag="histórico"
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

// ─── Prática integrada ─────────────────────────────────────────────────

function PraticaIntegrada() {
  return (
    <section style={{
      padding: '80px 0',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap">
        <Eyebrow>O outro lado da prática</Eyebrow>
        <H2>Tudo que sustenta o consultório,<br />numa só interface.</H2>

        <div className="lp-grid-2" style={{ marginTop: 36 }}>
          <BlocoOperacional
            icone="◷"
            titulo="Agenda"
            corpo="Sessões avulsas e séries recorrentes (paciente fixo toda sexta às 15h, 4 sessões). Visões de dia, semana e mês. Conflitos detectados antes do envio."
          />
          <BlocoOperacional
            icone="◑"
            titulo="Pagamentos PIX e cartão"
            corpo="Sub-conta Pagar.me por psicóloga. O dinheiro cai direto na sua conta — Auren nunca toca o valor. Repasses em D+1 (PIX) ou D+30 (cartão)."
          />
          <BlocoOperacional
            icone="◐"
            titulo="WhatsApp como interface do paciente"
            corpo="O paciente nunca instala nada. Tudo acontece pelo WhatsApp: confirmações, pagamento, lembretes, pós-sessão. Você acompanha por um único painel."
          />
          <BlocoOperacional
            icone="▶"
            titulo="Sala de vídeo embutida"
            corpo="Atendimento online com termo de consentimento padronizado (CFP 11/2018). Link gerado por sessão, válido por 4h. Áudio processado, vídeo nunca gravado."
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
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

// ─── Proteção mútua ─────────────────────────────────────────────────

function ProtecaoMutua() {
  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap" style={{ maxWidth: 780 }}>
        <Eyebrow>Proteção mútua</Eyebrow>
        <H2>Quem confirma que a sessão aconteceu<br />é o paciente.</H2>
        <P>
          Ao final de cada sessão, o paciente recebe uma mensagem no WhatsApp e tem 2 horas
          (ou até 9h da manhã seguinte, se for sessão noturna) pra confirmar
          ou contestar. Silêncio libera o repasse. Contestação pausa o pagamento e abre uma
          análise. Auren tem o registro com data, hora e IP — proteção pra ambos os lados.
        </P>

        <div style={{
          marginTop: 30, padding: 24, borderRadius: 12,
          background: 'rgba(106,78,200,.04)', border: '1px solid rgba(106,78,200,.18)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono), monospace', fontSize: 11,
            color: 'var(--accent)', marginBottom: 10, letterSpacing: '.08em',
          }}>EXEMPLO · WHATSAPP DO PACIENTE</div>
          <p style={{
            margin: 0, fontSize: 14, color: 'var(--ink-soft)',
            lineHeight: 1.65, fontStyle: 'italic',
          }}>
            &ldquo;Olá, Marina! Sua sessão de hoje às 15h com Dra. Ana ocorreu como combinado?<br />
            <span style={{ fontStyle: 'normal' }}>· Responda </span><strong>SIM</strong><span style={{ fontStyle: 'normal' }}> para confirmar</span><br />
            <span style={{ fontStyle: 'normal' }}>· Responda </span><strong>NAO</strong><span style={{ fontStyle: 'normal' }}> se tiver algo a relatar</span><br />
            <span style={{ fontStyle: 'normal' }}>Sem resposta em até 2 horas, o pagamento é liberado automaticamente.</span>&rdquo;
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Privacidade ───────────────────────────────────────────────────────

function Privacidade() {
  return (
    <section id="privacidade" style={{
      padding: '80px 0',
      background: 'linear-gradient(180deg, var(--page), rgba(90,158,138,.04) 50%, var(--page))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{ maxWidth: 880 }}>
        <Eyebrow>Privacidade por design</Eyebrow>
        <H2>Seus dados de paciente:<br />blindados em todas as camadas.</H2>

        <div className="lp-grid-2" style={{ marginTop: 36 }}>
          <Selo titulo="AES-256-GCM em repouso" corpo="Transcrição, resumos, notas clínicas e documentos sensíveis ficam criptografados no banco. A chave de criptografia não está acessível pelo painel — só pelo runtime do servidor." />
          <Selo titulo="TLS 1.3 em trânsito" corpo="Toda comunicação entre paciente, psicóloga, Auren e provedores externos usa criptografia de transporte moderna. Nada em texto claro." />
          <Selo titulo="Áudio descartado imediatamente" corpo="O áudio bruto da sessão é processado para transcrição e descartado em segundos. Nada de vídeo é gravado. Só a transcrição textual (criptografada) persiste." />
          <Selo titulo="Zero data training" corpo="Cláusula contratual com a Anthropic veda uso dos seus dados pra treinar modelos. Explícito no termo do paciente e auditável." />
          <Selo titulo="Consentimento granular" corpo="Paciente assina termo de uso pra atendimento online (CFP 11/2018), termo de consentimento informado para IA (CFP 09/2024) e termo LGPD. Tudo registrado com IP e timestamp." />
          <Selo titulo="Auren não toca seu dinheiro" corpo="Pagamentos vão direto pra sua sub-conta Pagar.me. Auren cobra apenas comissão via split automático. Risco de bloqueio bancário do Auren não afeta seu recebimento." />
        </div>
      </div>
    </section>
  )
}

function Selo({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div style={{
      padding: 22, borderRadius: 12,
      background: 'var(--card)', border: '1px solid var(--border)',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500,
        color: '#2a6456', margin: '0 0 8px',
      }}>✓ {titulo}</h4>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>{corpo}</p>
    </div>
  )
}

// ─── Para quem ─────────────────────────────────────────────────────────

function ParaQuem() {
  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
      <div className="lp-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <Eyebrow>Pra quem é</Eyebrow>
          <H2>Psicólogo clínico privado.<br />Prática online ou híbrida.</H2>
          <P>
            Auren Care foi desenhado pensando em quem atende entre 15 e 30 pacientes ativos —
            volume típico de quem tem prática autônoma e quer parar de operar a clínica em
            cinco abas abertas ao mesmo tempo.
          </P>
          <P style={{ marginTop: 14 }}>
            Não é um ERP. Não é um prontuário hospitalar. É a infraestrutura cognitiva
            e operacional da prática clínica moderna, num só lugar.
          </P>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <PerfilLinha numero="15-30" rotulo="pacientes ativos" />
          <PerfilLinha numero="50min" rotulo="sessão padrão" />
          <PerfilLinha numero="100%" rotulo="online ou híbrido" />
          <PerfilLinha numero="CRP" rotulo="ativo no Conselho Regional" />
        </div>
      </div>
    </section>
  )
}

function PerfilLinha({ numero, rotulo }: { numero: string; rotulo: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 14,
      padding: '14px 18px', borderRadius: 10,
      background: 'var(--surface)',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400,
        color: 'var(--accent)', minWidth: 80,
      }}>{numero}</span>
      <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{rotulo}</span>
    </div>
  )
}

// ─── Manifesto ─────────────────────────────────────────────────────────

function Manifesto() {
  const linhas = [
    'IA age muito, aparece pouco.',
    'Presente, não gravando.',
    'Frequência e observação, nunca diagnóstico.',
    'Rascunho até você assinar.',
    'Você é o psicólogo. Auren é seu sistema.',
  ]
  return (
    <section style={{
      padding: '100px 0',
      background: 'linear-gradient(135deg, rgba(106,78,200,.06), rgba(90,158,138,.06))',
      borderTop: '1px solid var(--border)',
    }}>
      <div className="lp-wrap" style={{ maxWidth: 720, textAlign: 'center' }}>
        <Eyebrow>Manifesto · resumo em cinco linhas</Eyebrow>
        <div style={{ display: 'grid', gap: 20, marginTop: 32 }}>
          {linhas.map((l, i) => (
            <p key={i} style={{
              fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300,
              fontStyle: 'italic',
              color: i === linhas.length - 1 ? '#291860' : 'var(--ink-soft)',
              lineHeight: 1.3, margin: 0,
              letterSpacing: '-.01em',
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
            Sem fidelidade, sem mensalidade durante o beta. Sua nota fiscal e a do paciente
            saem normalmente — Auren cobra apenas comissão por sessão paga.
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
            IA assistente · CFP 09/2024 · LGPD.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)', alignItems: 'flex-end' }}>
          <a href="/login" className="lp-link">Já tenho conta</a>
          <a href="mailto:contato@automaxia.com.br" className="lp-link">contato@automaxia.com.br</a>
          <span style={{ color: 'var(--faint)' }}>© Auren Care · {new Date().getFullYear()}</span>
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
