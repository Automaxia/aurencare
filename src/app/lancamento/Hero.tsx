'use client'

import { Logo } from '@/components/brand/Logo'

/**
 * Hero da landing — produto PRIMEIRO, conceito depois. Posiciona a Audere como
 * plataforma de continuidade terapêutica (a IA trabalha nos bastidores, não é o
 * protagonista). Acima da dobra o visitante entende em segundos: o que é, pra
 * quem, que problema resolve, como funciona e por que é diferente.
 *
 * Hierarquia: headline → subheadline → CTA → produto (AHA) → benefícios → scroll.
 */
export function Hero() {
  return (
    <section className="hero2" aria-labelledby="hero-h1">
      <div aria-hidden className="hero2-glow" />
      <div className="lp-wrap hero2-grid">
        {/* Copy */}
        <div className="hero2-copy">
          <div className="hero2-eyebrow">Continuidade terapêutica · para psicólogos clínicos</div>
          <h1 id="hero-h1" className="hero2-h1">
            Chegue em cada sessão sabendo <em>exatamente onde o paciente parou.</em>
          </h1>
          <p className="hero2-sub">
            A Audere reúne sessões, temas, objetivos e evolução numa linha do tempo
            clínica viva. A continuidade do cuidado deixa de depender da sua memória —
            e você recupera a tranquilidade de estar sempre preparado.
          </p>

          <div className="hero2-cta">
            <a href="#acesso" className="hero2-btn-primary">Quero chegar preparado →</a>
            <a href="#continuidade" className="hero2-btn-ghost">Ver como funciona</a>
          </div>

          <ul className="hero2-trust" aria-label="Confiança e conformidade">
            <li>Feito com psicólogos brasileiros</li>
            <li>LGPD + CFP</li>
            <li>Áudio descartado após a transcrição</li>
            <li>Beta por convite</li>
          </ul>
        </div>

        {/* Produto — o "aha moment" */}
        <div className="hero2-product">
          <HeroMockup />
        </div>
      </div>

      {/* Diferenciação visual */}
      <div className="lp-wrap">
        <Diferenciacao />
      </div>

      <a className="hero2-scroll" href="#continuidade" aria-label="Rolar para saber mais">
        <span>como funciona</span>
        <span className="hero2-scroll-arrow" aria-hidden>↓</span>
      </a>

      <HeroStyles />
    </section>
  )
}

// ─── Mockup do produto (preparo pré-sessão · AHA) ──────────────────────
const SINAIS = [
  { ico: '◍', cor: 'var(--accent)', txt: <><strong>Ansiedade</strong> reapareceu — após 6 semanas ausente</> },
  { ico: '↑', cor: 'var(--sage)',   txt: <>Objetivo <strong>Autoestima</strong> evoluiu <strong>+18%</strong></> },
  { ico: '❝', cor: 'var(--rose)',   txt: <>Tema <strong>&ldquo;mãe&rdquo;</strong> citado de novo · 3ª sessão</> },
  { ico: '◔', cor: 'var(--muted)',  txt: <>Última sessão há <strong>12 dias</strong></> },
]

function HeroMockup() {
  return (
    <div className="mock" role="img" aria-label="Painel da Audere mostrando o preparo automático da próxima sessão: ansiedade reapareceu após 6 semanas, objetivo de autoestima evoluiu 18%, tema mãe citado de novo, última sessão há 12 dias.">
      <div className="mock-bar">
        <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
        <span className="mock-url"><Logo size={15} /> continuidade clínica</span>
      </div>
      <div className="mock-body">
        <div className="mock-head">
          <div>
            <div className="mock-name">Marina K. <span>· Sessão 8</span></div>
            <div className="mock-when">próxima quinta · 18h00</div>
          </div>
          <span className="mock-pill">preparo automático</span>
        </div>

        <div className="mock-sec">Antes de você abrir a sessão, a Audere já reuniu:</div>
        <ul className="mock-signals">
          {SINAIS.map((s, i) => (
            <li key={i} className="mock-signal" style={{ animationDelay: `${0.5 + i * 0.22}s` }}>
              <span className="mock-ic" style={{ color: s.cor, background: `color-mix(in srgb, ${s.cor} 12%, transparent)` }}>{s.ico}</span>
              <span className="mock-tx">{s.txt}</span>
            </li>
          ))}
        </ul>

        <div className="mock-tl">
          <div className="mock-tl-lbl">linha do tempo · 8 sessões</div>
          <svg viewBox="0 0 300 26" className="mock-tl-svg" preserveAspectRatio="none">
            <line x1="6" y1="13" x2="294" y2="13" stroke="var(--border)" strokeWidth="2" />
            {Array.from({ length: 8 }).map((_, i) => {
              const x = 6 + (i / 7) * 288
              const last = i === 7
              return <circle key={i} cx={x} cy={13} r={last ? 5 : 3.4} fill={last ? 'var(--accent)' : 'var(--card)'} stroke="var(--accent)" strokeWidth="1.6" style={{ opacity: 0.55 + i * 0.06 }} />
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Diferenciação (sem texto longo) ───────────────────────────────────
function Diferenciacao() {
  return (
    <div className="hero2-diff">
      <div className="diff-col">
        <span className="diff-lbl">Outros sistemas</span>
        <div className="diff-flow diff-old">
          <span>Agenda</span><i>→</i><span>Prontuário</span><i>→</i><span className="diff-dead">Sessão isolada</span>
        </div>
      </div>
      <div className="diff-col">
        <span className="diff-lbl diff-lbl-on">Audere</span>
        <div className="diff-flow diff-new">
          <span>Sessão</span><i>→</i><span>Sessão</span><i>→</i><span>Sessão</span><i>→</i><span className="diff-live">Continuidade clínica</span>
        </div>
      </div>
    </div>
  )
}

function HeroStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .hero2 { position:relative; overflow:hidden; padding:40px 0 28px; background:var(--page);
        display:flex; flex-direction:column; min-height:calc(100vh - 56px); }
      .hero2-glow { position:absolute; inset:0; pointer-events:none; z-index:0;
        background:
          radial-gradient(60% 50% at 78% 22%, rgba(106,78,200,.08), transparent 70%),
          radial-gradient(50% 45% at 12% 78%, rgba(90,158,138,.06), transparent 72%); }
      .hero2-grid { position:relative; z-index:1; flex:1;
        display:grid; grid-template-columns:1.02fr 1.1fr; gap:52px; align-items:center; }

      .hero2-eyebrow { font-size:12px; color:var(--accent); text-transform:uppercase;
        letter-spacing:.14em; font-weight:600; margin-bottom:18px; }
      .hero2-h1 { font-family:var(--font-display), serif; font-weight:300; font-size:clamp(34px,4.4vw,56px);
        line-height:1.08; letter-spacing:-.018em; color:#291860; margin:0 0 20px; text-wrap:balance; }
      .hero2-h1 em { font-style:italic;
        background:linear-gradient(90deg,#6a4ec8,#5c9d88); -webkit-background-clip:text;
        background-clip:text; -webkit-text-fill-color:transparent; }
      .hero2-sub { font-size:clamp(15px,1.35vw,18px); color:var(--ink-soft); line-height:1.6;
        max-width:540px; margin:0 0 28px; font-weight:300; }

      .hero2-cta { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:22px; }
      .hero2-btn-primary { display:inline-flex; align-items:center; gap:8px; padding:14px 26px;
        border-radius:999px; background:var(--accent); color:#fff; font-size:15px; font-weight:500;
        text-decoration:none; box-shadow:0 12px 30px rgba(106,78,200,.26);
        transition:transform .18s var(--ease), box-shadow .18s var(--ease); }
      .hero2-btn-primary:hover { transform:translateY(-2px); box-shadow:0 18px 40px rgba(106,78,200,.34); }
      .hero2-btn-ghost { display:inline-flex; align-items:center; padding:14px 22px; border-radius:999px;
        background:transparent; color:var(--ink-soft); border:1px solid var(--border); font-size:15px;
        font-weight:500; text-decoration:none; transition:all .18s var(--ease); }
      .hero2-btn-ghost:hover { border-color:var(--accent); color:var(--accent); background:var(--card); }

      .hero2-trust { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px 18px; }
      .hero2-trust li { font-size:12.5px; color:var(--muted); display:flex; align-items:center; gap:7px; }
      .hero2-trust li::before { content:"✓"; color:var(--sage); font-weight:700; font-size:12px; }

      /* Mockup */
      .hero2-product { position:relative; }
      .mock { background:var(--card); border:1px solid var(--border); border-radius:18px; overflow:hidden;
        box-shadow:0 40px 90px -30px rgba(41,24,96,.32), 0 8px 30px rgba(26,24,37,.06);
        animation:heroRise .8s var(--ease) both; }
      .mock-bar { display:flex; align-items:center; gap:7px; padding:11px 14px;
        background:var(--surface); border-bottom:1px solid var(--border); }
      .mock-dot { width:9px; height:9px; border-radius:50%; background:var(--faint); opacity:.5; }
      .mock-url { margin-left:10px; display:inline-flex; align-items:center; gap:8px; font-size:12px;
        color:var(--muted); }
      .mock-body { padding:20px 22px 22px; }
      .mock-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:18px; }
      .mock-name { font-size:17px; font-weight:600; color:var(--ink); }
      .mock-name span { font-weight:400; color:var(--muted); font-size:13px; }
      .mock-when { font-size:12.5px; color:var(--muted); margin-top:3px; }
      .mock-pill { font-size:10.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase;
        color:var(--accent); background:rgba(106,78,200,.10); padding:5px 10px; border-radius:999px; white-space:nowrap; }
      .mock-sec { font-size:12px; color:var(--muted); margin-bottom:12px; }
      .mock-signals { list-style:none; margin:0 0 18px; padding:0; display:grid; gap:9px; }
      .mock-signal { display:flex; align-items:center; gap:12px; padding:11px 13px; border-radius:12px;
        background:var(--surface); border:1px solid var(--border); animation:heroSignal .55s var(--ease) both; }
      .mock-ic { flex:none; width:30px; height:30px; border-radius:9px; display:flex; align-items:center;
        justify-content:center; font-size:15px; }
      .mock-tx { font-size:13.5px; color:var(--ink-soft); line-height:1.4; }
      .mock-tx strong { color:var(--ink); font-weight:600; }
      .mock-tl-lbl { font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; margin-bottom:7px; }
      .mock-tl-svg { width:100%; height:26px; display:block; }

      /* Diferenciação */
      .hero2-diff { position:relative; z-index:1; display:grid; grid-template-columns:1fr 1fr; gap:16px;
        margin-top:30px; padding-top:22px; border-top:1px solid var(--border); }
      .diff-col { display:flex; flex-direction:column; gap:9px; }
      .diff-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.1em; font-weight:600; color:var(--muted); }
      .diff-lbl-on { color:var(--accent); }
      .diff-flow { display:flex; align-items:center; gap:9px; flex-wrap:wrap; font-size:13.5px; }
      .diff-flow span { padding:6px 12px; border-radius:8px; }
      .diff-flow i { font-style:normal; color:var(--faint); }
      .diff-old span { background:var(--surface); color:var(--muted); }
      .diff-old .diff-dead { color:var(--faint); text-decoration:line-through; text-decoration-color:rgba(122,117,144,.4); }
      .diff-new span { background:rgba(106,78,200,.07); color:var(--ink-soft); }
      .diff-new .diff-live { background:linear-gradient(90deg, rgba(106,78,200,.14), rgba(90,158,138,.14));
        color:#391d96; font-weight:600; }

      .hero2-scroll { position:relative; z-index:1; align-self:center; margin-top:22px;
        display:inline-flex; flex-direction:column; align-items:center; gap:5px; text-decoration:none;
        font-size:11.5px; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; }
      .hero2-scroll-arrow { font-size:17px; color:var(--accent); animation:heroBob 1.7s ease-in-out infinite; }

      @keyframes heroRise { from{ opacity:0; transform:translateY(22px) scale(.985); } to{ opacity:1; transform:none; } }
      @keyframes heroSignal { from{ opacity:0; transform:translateY(9px); } to{ opacity:1; transform:none; } }
      @keyframes heroBob { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(5px); } }

      @media (max-width:940px) {
        .hero2 { min-height:0; padding:28px 0; }
        .hero2-grid { grid-template-columns:1fr; gap:34px; }
        .hero2-h1 { font-size:34px; }
        .hero2-diff { grid-template-columns:1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .mock, .mock-signal, .hero2-scroll-arrow { animation:none !important; opacity:1 !important; transform:none !important; }
      }
    ` }} />
  )
}
