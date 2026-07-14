'use client'
/* Seções D — Privacidade · Manifesto (curado P2) · Confiança · Footer. */
import React from 'react'
import { Section, Eyebrow, Display, Spiral, Wordmark, useInView, useRaf } from './core'

const PRIVACY = [
  { t: 'AES-256-GCM em repouso · TLS 1.3 em trânsito', d: 'Transcrições, resumos e notas clínicas criptografados. A chave não é acessível pelo painel, só pelo runtime do servidor.' },
  { t: 'Áudio descartado imediatamente', d: 'Processado para transcrição e deletado em segundos. Nada de vídeo é gravado. Só a transcrição textual (criptografada) persiste.' },
  { t: 'Zero data training · cláusula com a Anthropic', d: 'Seus dados não treinam nenhum modelo. Explícito no termo do paciente e auditável a qualquer momento.' },
  { t: 'Consentimento granular registrado', d: 'Termos CFP 11/2018, CFP 09/2024 e LGPD, assinados com IP e timestamp automáticos.' },
  { t: 'Pagamentos com padrão bancário', d: 'Processamento certificado PCI DSS Nível 1: antifraude, autenticação 3DS 2.0 e tokenização de cartão. Em conformidade com o Banco Central.' },
  { t: 'A Audere não toca no seu dinheiro', d: 'O que seus pacientes pagam cai direto na sua conta, por processador certificado e independente.' },
]

export function PrivacySection() {
  return (
    <Section id="privacidade" tint>
      <div className="priv-head">
        <Eyebrow color="var(--accent)">Privacidade por design</Eyebrow>
        <Display size="clamp(30px,3.9vw,54px)" style={{ marginTop: 18, maxWidth: 880 }}>
          Seus dados de paciente: <em style={{ color: 'var(--accent)' }}>blindados em todas as camadas.</em>
        </Display>
        <p className="sec-lead">
          Construído com LGPD, CFP 09/2024 e CFP 11/2018 como base, não como checklist no fim do projeto.
        </p>
      </div>
      <div className="priv-cols">
        <div className="priv-checklist">
          {PRIVACY.map((p, i) => (
            <div className="priv-row" key={i}>
              <span className="priv-check">✓</span>
              <div><h3>{p.t}</h3><p>{p.d}</p></div>
            </div>
          ))}
        </div>
        <div className="priv-aside">
          <div className="priv-note-card">
            <div className="priv-note-eye">A Audere observa · você decide</div>
            <p>Toda sugestão usa linguagem observacional: frequência, padrão, co-ocorrência. Uma camada de
              validação segura o texto se ele escapar para o território de interpretação. A decisão terapêutica
              é sempre sua.</p>
          </div>
          <div className="priv-note-card">
            <div className="priv-note-eye">Sempre rascunho</div>
            <p>Resumos, observações e marcações ficam para você revisar. Nenhuma nota vira prontuário sem a
              sua leitura e assinatura.</p>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* P2 — Manifesto enxugado: 1 setup comprimido + 2 fechos únicos (sem repetir a
   tese já dita em Problema/Tese/Convergência). Termina na linha mais forte. */
const MANIFESTO = [
  'A terapia acontece ao longo do tempo — mas cada ferramenta ainda trata a sessão como um evento isolado.',
  'A continuidade do cuidado não deveria depender só da memória de ninguém.',
  'O paciente nunca foi uma sessão. Sempre foi uma história.',
]

export function ManifestoSection() {
  const [ref, vis] = useInView()
  const t = useRaf(vis)
  const hi = Math.floor((t / 2.4) % MANIFESTO.length)
  return (
    <Section id="manifesto" dark>
      <div className="mani">
        <div className="mani-mark">
          <Spiral size={52} sw={1.6} color="#b9a6f5" tip="#7fcdb8" />
          <span>Por que a Audere existe</span>
        </div>
        <div className="mani-lines" ref={ref as any}>
          {MANIFESTO.map((m, i) => (
            <p key={i} className={'mani-line serif' + (i === hi ? ' on' : '')}>{m}</p>
          ))}
        </div>
      </div>
    </Section>
  )
}

const TRUST = [
  { t: 'Nascido na prática clínica real', d: 'Cada decisão de produto vem de quem atende, não de um genérico de software.' },
  { t: 'Construído sobre CFP 09/2024, CFP 11/2018 e LGPD', d: 'Ética e privacidade são a fundação, não um adendo. Linguagem observacional, nunca diagnóstica.' },
  { t: 'Beta por convite, acompanhado de perto', d: 'Abrimos acesso em ondas pequenas para acompanhar cada conta na fase inicial.' },
]

export function TrustSection() {
  return (
    <Section id="confianca">
      <div style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto' }}>
        <Eyebrow color="var(--accent)" style={{ justifyContent: 'center' }}>Construído do lado de dentro do consultório</Eyebrow>
        <Display size="clamp(32px,4.4vw,58px)" style={{ marginTop: 18 }}>
          Feito por psicólogos, <em style={{ color: 'var(--accent)' }}>para psicólogos.</em>
        </Display>
      </div>
      <div className="trust-cards">
        {TRUST.map((x, i) => (
          <div className="trust-card" key={i}><h3>{x.t}</h3><p>{x.d}</p></div>
        ))}
      </div>
    </Section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Wordmark size={30} dark sub="" />
          <p className="footer-tag">A primeira plataforma de Inteligência Clínica Longitudinal do Brasil.</p>
        </div>
        <div className="footer-links">
          <a href="#plataforma">Plataforma</a>
          <a href="#privacidade">Privacidade</a>
          <a href="#confianca">Feito por psicólogos</a>
          <a href="#acesso">Acesso antecipado</a>
          <a href="/login">Já tenho conta</a>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>contato@automaxia.com.br</span>
        <span>© Audere · 2026</span>
      </div>
    </footer>
  )
}
