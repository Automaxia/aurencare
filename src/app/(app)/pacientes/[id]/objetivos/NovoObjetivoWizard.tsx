'use client'

import { useState } from 'react'
import type { Objetivo, MetricaTipo, MetricaDirecao } from '@/server/services/objetivos'
import { criarObjetivoAction } from './actions'

/**
 * Wizard de criação de objetivo no padrão SMART, inspirado em planejadores
 * clínicos (estilo Daniel Versiani — TCC/produtividade). Cada passo tem uma
 * "tip clínica" com perguntas-guia que ajudam o(a) psicólogo(a) a redigir
 * com qualidade.
 *
 * Passos:
 *   0. Tipo de métrica (absoluta vs GAS)
 *   1. S — Específico (título)
 *   2. R — Relevante (contexto clínico)
 *   3. M — Mensurável (unidade + baseline + alvo)  [oculto em GAS]
 *   4. A — Atingível (sub-passos, recursos, obstáculos)
 *   5. T — Temporal (prazo)
 *   6. Revisão final
 */

type Props = {
  pacienteId: string
  tituloInicial?: string
  onCriado: (o: Objetivo) => void
  onCancelar: () => void
}

type Step = 'tipo' | 's' | 'r' | 'm' | 'a' | 't' | 'revisao' | 'livre'

/** Espelha SmartSugestao do server (copilotoObjetivos) — tipo local pra não
 *  importar módulo server-only no client. */
type SmartSugestao = {
  titulo: string
  relevancia: string
  metricaTipo: 'absoluta' | 'gas'
  unidade: string | null
  baseline: number | null
  alvo: number | null
  prazoSemanas: number | null
  tema: string | null
}

export function NovoObjetivoWizard({ pacienteId, tituloInicial, onCriado, onCancelar }: Props) {
  // ── Estado dos campos ────────────────────────────────────────────
  const [tipo, setTipo]           = useState<MetricaTipo>('absoluta')
  const [titulo, setTitulo]       = useState(tituloInicial ?? '')
  const [descricao, setDescricao] = useState('')   // R — relevância clínica
  const [unidade, setUnidade]     = useState('')
  const [baseline, setBaseline]   = useState('')
  const [alvo, setAlvo]           = useState('')
  const [subPassos, setSubPassos] = useState('')   // A — sub-passos/recursos/obstáculos (texto livre)
  const [prazo, setPrazo]         = useState('')

  // ── Wizard state ─────────────────────────────────────────────────
  const [step, setStep]           = useState<Step>('tipo')
  const [erro, setErro]           = useState<string | null>(null)
  const [salvando, setSalvando]   = useState(false)

  // ── Copiloto da Audere (sugestões SMART por IA, sob demanda) ─────
  const [sugIa, setSugIa]               = useState<SmartSugestao[] | null>(null)
  const [carregandoIa, setCarregandoIa] = useState(false)
  const [erroIa, setErroIa]             = useState<string | null>(null)

  async function pedirCopiloto() {
    setCarregandoIa(true); setErroIa(null)
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/objetivos/copiloto`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErroIa('Não consegui sugerir agora. Tente de novo.'); setSugIa(null) }
      else if (!json.sugestoes?.length) { setErroIa('Ainda não há temas suficientes para sugerir — registre mais sessões.'); setSugIa([]) }
      else { setSugIa(json.sugestoes); setErroIa(null) }
    } catch {
      setErroIa('Não consegui sugerir agora. Tente de novo.')
    } finally {
      setCarregandoIa(false)
    }
  }

  function aplicarSugestao(s: SmartSugestao) {
    // Se o psicólogo já escolheu o método Simples (nenhuma) ou está no passo livre,
    // a sugestão é mantida como Simples. Senão, segue o tipo da sugestão
    // ('gas' subjetiva → 'nenhuma'; o GAS é configurado na tela da meta).
    const querSimples = tipo === 'nenhuma' || step === 'livre'
    const tipoAplicado: MetricaTipo = querSimples ? 'nenhuma' : (s.metricaTipo === 'absoluta' ? 'absoluta' : 'nenhuma')
    setTipo(tipoAplicado)
    setTitulo(s.titulo)
    setDescricao(s.relevancia)
    if (tipoAplicado === 'absoluta') {
      setUnidade(s.unidade ?? '')
      setBaseline(s.baseline != null ? String(s.baseline) : '')
      setAlvo(s.alvo != null ? String(s.alvo) : '')
    } else {
      setUnidade(''); setBaseline(''); setAlvo('')
    }
    if (s.prazoSemanas && s.prazoSemanas > 0) {
      const d = new Date(); d.setDate(d.getDate() + s.prazoSemanas * 7)
      setPrazo(d.toISOString().slice(0, 10))
    }
    setSugIa(null); setErroIa(null); setErro(null)
    setStep(tipoAplicado === 'absoluta' ? 'revisao' : 'livre')
  }

  // Dois métodos: SMART + GAS (absoluta, fluxo completo) ou Livre (nenhuma, entrada única).
  const sequencia: Step[] = tipo === 'absoluta'
    ? ['tipo', 's', 'r', 'm', 'a', 't', 'revisao']   // SMART + GAS
    : ['tipo', 'livre']                               // Objetivo Terapêutico Simples — livre é livre
  const idx       = sequencia.indexOf(step)
  const primeiro  = idx === 0
  const ultimo    = idx === sequencia.length - 1

  // ── Direção sugerida (Métrica absoluta) ──────────────────────────
  const baselineN = parseFloat(baseline.replace(',', '.'))
  const alvoN     = parseFloat(alvo.replace(',', '.'))
  const direcao: MetricaDirecao =
    !isNaN(baselineN) && !isNaN(alvoN) && baselineN !== alvoN
      ? (alvoN > baselineN ? 'aumentar' : 'diminuir')
      : 'aumentar'

  // ── Validação por passo ──────────────────────────────────────────
  function validarAtual(): boolean {
    setErro(null)
    switch (step) {
      case 's':
        if (titulo.trim().length < 4) { setErro('Descreva o objetivo de forma específica (mínimo 4 caracteres).'); return false }
        return true
      case 'livre':
        if (titulo.trim().length < 4) { setErro('Escreva o objetivo (mínimo 4 caracteres).'); return false }
        return true
      case 'r':
        // Descricao opcional, mas recomendada — não bloqueia
        return true
      case 'm':
        if (tipo === 'absoluta') {
          if (!unidade.trim()) { setErro('Defina a unidade que vai medir (ex: ataques/semana, min/dia).'); return false }
          if (isNaN(baselineN)) { setErro('Informe o valor de partida (baseline).'); return false }
          if (isNaN(alvoN)) { setErro('Informe o valor alvo.'); return false }
          if (baselineN === alvoN) { setErro('Baseline e alvo precisam ser diferentes.'); return false }
        }
        return true
      case 'a':
        // Texto livre opcional
        return true
      case 't':
        // #5: prazo é opcional (varia caso a caso).
        return true
      default: return true
    }
  }

  function avancar() {
    if (!validarAtual()) return
    const prox = sequencia[idx + 1]
    if (prox) setStep(prox)
  }

  function voltar() {
    setErro(null)
    const ant = sequencia[idx - 1]
    if (ant) setStep(ant)
  }

  async function salvar() {
    setErro(null); setSalvando(true)
    const r = await criarObjetivoAction(pacienteId, {
      titulo: titulo.trim(),
      descricao: (descricao.trim() + (subPassos.trim() ? `\n\nPlano de ação:\n${subPassos.trim()}` : '')) || null,
      metricaTipo: tipo,
      metricaUnidade: tipo === 'absoluta' ? unidade.trim() : null,
      metricaBaseline: tipo === 'absoluta' ? baselineN : null,
      metricaAlvo: tipo === 'absoluta' ? alvoN : null,
      metricaDirecao: tipo === 'absoluta' ? direcao : 'aumentar',
      prazoEm: prazo || null,
    })
    setSalvando(false)
    if (r) onCriado(r)
    else setErro('Não foi possível criar agora.')
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="card" style={{ display: 'grid', gap: 18, marginBottom: 16, padding: 22 }}>
      <CopilotoObjetivos
        sugestoes={sugIa}
        carregando={carregandoIa}
        erro={erroIa}
        onPedir={pedirCopiloto}
        onAplicar={aplicarSugestao}
      />

      <Stepper sequencia={sequencia} atual={step} />

      {step === 'tipo'    && <PassoTipo   tipo={tipo} onChange={setTipo} />}
      {step === 'livre'   && <PassoLivre  titulo={titulo} setTitulo={setTitulo} descricao={descricao} setDescricao={setDescricao} prazo={prazo} setPrazo={setPrazo} />}
      {step === 's'       && <PassoS      titulo={titulo} onChange={setTitulo} />}
      {step === 'r'       && <PassoR      descricao={descricao} onChange={setDescricao} />}
      {step === 'm'       && <PassoM      tipo={tipo} unidade={unidade} setUnidade={setUnidade} baseline={baseline} setBaseline={setBaseline} alvo={alvo} setAlvo={setAlvo} direcaoSugerida={!isNaN(baselineN) && !isNaN(alvoN) && baselineN !== alvoN ? direcao : null} />}
      {step === 'a'       && <PassoA      subPassos={subPassos} onChange={setSubPassos} />}
      {step === 't'       && <PassoT      prazo={prazo} onChange={setPrazo} />}
      {step === 'revisao' && <Revisao     {...{ tipo, titulo, descricao, unidade, baseline, alvo, direcao, subPassos, prazo }} />}

      {erro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}

      {/* Navegação */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button type="button" className="btn ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {!primeiro && (
            <button type="button" className="btn ghost" onClick={voltar} disabled={salvando}>
              ← Voltar
            </button>
          )}
          {!ultimo ? (
            <button type="button" className="btn primary" onClick={avancar}>
              Continuar →
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Criando…' : '✓ Criar objetivo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Copiloto da Audere ─────────────────────────────────────────────────

function CopilotoObjetivos({ sugestoes, carregando, erro, onPedir, onAplicar }: {
  sugestoes: SmartSugestao[] | null
  carregando: boolean
  erro: string | null
  onPedir: () => void
  onAplicar: (s: SmartSugestao) => void
}) {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--border)', padding: 14,
      background: 'linear-gradient(135deg, rgba(106,78,200,.06), rgba(90,158,138,.045))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Copiloto da Audere</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>
              Sugestões de metas SMART a partir dos temas observados nas sessões.
            </div>
          </div>
        </div>
        {!sugestoes?.length && (
          <button type="button" className="btn ghost" onClick={onPedir} disabled={carregando}
            style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
            {carregando ? 'Pensando…' : '✨ Sugerir metas'}
          </button>
        )}
      </div>

      {erro && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{erro}</div>}

      {!!sugestoes?.length && (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {sugestoes.map((s, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'grid', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{s.titulo}</div>
                <button type="button" className="btn primary" onClick={() => onAplicar(s)}
                  style={{ flex: 'none', fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}>
                  Usar esta meta →
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{s.relevancia}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono), monospace' }}>
                {s.metricaTipo === 'absoluta'
                  ? `${s.unidade ?? 'unidade'} · ${s.baseline ?? '—'} → ${s.alvo ?? '—'}`
                  : 'GAS · escala −2…+2'}
                {s.prazoSemanas ? ` · ${s.prazoSemanas} sem` : ''}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.5 }}>
            Rascunho gerado pela Audere · revise e ajuste cada campo antes de salvar · observação, não diagnóstico · CFP 09/2024
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stepper visual ─────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  tipo:    'Método',
  s:       'Específico',
  r:       'Relevante',
  m:       'Mensurável',
  a:       'Atingível',
  t:       'Temporal',
  revisao: 'Revisão',
  livre:   'Objetivo',
}

function Stepper({ sequencia, atual }: { sequencia: Step[]; atual: Step }) {
  const idx = sequencia.indexOf(atual)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {sequencia.map((s, i) => {
        const ativo = i === idx
        const feito = i < idx
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              minWidth: 22, height: 22, padding: '0 8px', borderRadius: 999,
              background: feito ? 'var(--sage)' : ativo ? 'var(--accent)' : 'var(--surface)',
              color: feito || ativo ? 'white' : 'var(--muted)',
              fontSize: 11, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              border: ativo || feito ? 'none' : '1px solid var(--border)',
              transition: 'all .15s var(--ease)',
            }}>
              {feito ? '✓' : <strong>{s === 'tipo' || s === 'revisao' ? '·' : s.toUpperCase()}</strong>}
              {!feito && <span style={{ fontWeight: 400, fontSize: 10.5 }}>{STEP_LABELS[s]}</span>}
            </span>
            {i < sequencia.length - 1 && <span style={{ color: 'var(--faint)', fontSize: 10 }}>→</span>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tip Banner ─────────────────────────────────────────────────────────

function Tip({ titulo, perguntas, exemplo, cor = 'accent' }: {
  titulo: string
  perguntas: string[]
  exemplo?: string
  cor?: 'accent' | 'sage' | 'amber'
}) {
  const bg = cor === 'sage' ? 'rgba(90,158,138,.08)'
           : cor === 'amber' ? 'rgba(176,125,64,.08)'
           : 'rgba(106,78,200,.07)'
  const border = cor === 'sage' ? 'rgba(90,158,138,.22)'
              : cor === 'amber' ? 'rgba(176,125,64,.22)'
              : 'rgba(106,78,200,.22)'
  const acento = cor === 'sage' ? 'var(--sage)' : cor === 'amber' ? 'var(--amber)' : 'var(--accent)'

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      background: bg, border: `1px solid ${border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: acento, textTransform: 'uppercase',
        letterSpacing: '.06em', fontWeight: 600, marginBottom: 8,
      }}>
        <span>💡</span> {titulo}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
        {perguntas.map((p, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--muted)', marginRight: 6 }}>›</span>{p}
          </li>
        ))}
      </ul>
      {exemplo && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(0,0,0,.025)', fontSize: 12, color: 'var(--muted)',
          fontStyle: 'italic', lineHeight: 1.55,
        }}>
          <strong style={{ fontStyle: 'normal', color: 'var(--ink-soft)' }}>Exemplo:</strong> {exemplo}
        </div>
      )}
    </div>
  )
}

// ─── Passos ────────────────────────────────────────────────────────────

function HeaderPasso({ letra, titulo, sub }: { letra: string; titulo: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(106,78,200,.12)', color: '#391d96',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0,
      }}>{letra}</span>
      <div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400,
          margin: 0, color: 'var(--ink)',
        }}>{titulo}</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.55 }}>{sub}</p>
      </div>
    </div>
  )
}

function PassoTipo({ tipo, onChange }: { tipo: MetricaTipo; onChange: (t: MetricaTipo) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="·" titulo="Como você quer registrar os objetivos?" sub="Escolha o método. Você pode misturar os dois na mesma terapia — cada meta no formato que fizer sentido." />
      <div style={{ display: 'grid', gap: 10 }}>
        <OpcaoCard
          ativo={tipo === 'absoluta'}
          onClick={() => onChange('absoluta')}
          titulo="Objetivos SMART + GAS"
          corpo="Método estruturado: meta específica, mensurável (unidade, baseline e alvo) e temporal — com acompanhamento por escalas GAS. Para quando você quer medir a evolução com precisão."
        />
        <OpcaoCard
          ativo={tipo === 'nenhuma'}
          onClick={() => onChange('nenhuma')}
          titulo="Objetivo Terapêutico Simples"
          corpo="Livre é livre: uma única caixa de texto, do seu jeito. Sem campos obrigatórios nem etapas. Você ainda pode acompanhar com escalas GAS depois, se quiser."
        />
      </div>
    </div>
  )
}

function OpcaoCard({ ativo, onClick, titulo, corpo }: { ativo: boolean; onClick: () => void; titulo: string; corpo: string }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        textAlign: 'left', padding: 16, borderRadius: 10,
        background: ativo ? 'rgba(106,78,200,.06)' : 'var(--card)',
        border: `1.5px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all .15s var(--ease)',
        display: 'grid', gap: 4,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{corpo}</div>
    </button>
  )
}

function PassoLivre({ titulo, setTitulo, descricao, setDescricao, prazo, setPrazo }: {
  titulo: string; setTitulo: (v: string) => void
  descricao: string; setDescricao: (v: string) => void
  prazo: string; setPrazo: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="·" titulo="Objetivo Terapêutico Simples" sub="Livre é livre. Escreva do seu jeito — sem campos obrigatórios nem etapas." />
      <input
        autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
        placeholder="Escreva o objetivo…" className="liv-inp"
      />
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Detalhes (opcional)</span>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4}
          placeholder="Contexto, o que observar, como saberá que avançou…" className="liv-inp liv-area" />
      </label>
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Prazo (opcional)</span>
        <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="liv-inp" style={{ maxWidth: 200 }} />
      </label>
      <style jsx>{`
        .liv-inp {
          width: 100%; box-sizing: border-box; padding: 13px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 15px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease);
        }
        .liv-inp:focus { border-color: var(--accent); }
        .liv-area { font-size: 14px; resize: vertical; min-height: 90px; line-height: 1.5; }
      `}</style>
    </div>
  )
}

function PassoS({ titulo, onChange }: { titulo: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="S" titulo="Específico" sub="O que muda de forma clara e observável?" />
      <Tip
        titulo="Perguntas que ajudam a refinar"
        perguntas={[
          'O que muda de forma observável no comportamento ou na experiência?',
          'Como você (ou o paciente) reconhece que isso está acontecendo?',
          'Está escrito como ação concreta — ou como sentimento abstrato?',
        ]}
        exemplo="Reduzir frequência de ataques de pânico fora de casa."
      />
      <input
        autoFocus
        value={titulo}
        onChange={e => onChange(e.target.value)}
        placeholder="Escreva o objetivo de forma específica"
        className="inp-lg"
      />
      <style jsx>{`
        .inp-lg {
          width: 100%; padding: 13px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 15px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease);
        }
        .inp-lg:focus { border-color: var(--accent); }
      `}</style>
    </div>
  )
}

function PassoR({ descricao, onChange }: { descricao: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="R" titulo="Relevante" sub="Por que esse objetivo importa agora? Qual a conexão com a queixa principal?" />
      <Tip
        cor="sage"
        titulo="Justificativa clínica"
        perguntas={[
          'Como isso se conecta com a queixa principal trazida pelo paciente?',
          'Quais áreas da vida ficam afetadas se este objetivo não for atingido?',
          'O paciente está engajado nesse objetivo, ou foi proposta sua?',
        ]}
        exemplo="Os ataques têm impedido a paciente de sair pra trabalhar, gerando risco de demissão e isolamento social."
      />
      <textarea
        autoFocus
        rows={4}
        value={descricao}
        onChange={e => onChange(e.target.value)}
        placeholder="Descreva o contexto clínico e a relevância (opcional, mas recomendado)"
        className="inp-lg"
      />
      <style jsx>{`
        .inp-lg {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
          resize: vertical; line-height: 1.55;
        }
        .inp-lg:focus { border-color: var(--accent); }
      `}</style>
    </div>
  )
}

function PassoM({ tipo, unidade, setUnidade, baseline, setBaseline, alvo, setAlvo, direcaoSugerida }: {
  tipo: MetricaTipo
  unidade: string; setUnidade: (v: string) => void
  baseline: string; setBaseline: (v: string) => void
  alvo: string; setAlvo: (v: string) => void
  direcaoSugerida: MetricaDirecao | null
}) {
  if (tipo === 'gas') {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <HeaderPasso letra="M+A" titulo="Goal Attainment Scale" sub="Escala padrão (−2 a +2). Em GAS você não precisa definir baseline/alvo — eles são fixos pela própria escala." />
        <Tip
          titulo="Como interpretar cada nível"
          perguntas={[
            '+2 — muito melhor que o esperado',
            '+1 — melhor que o esperado',
            ' 0 — baseline (sem mudança)',
            '−1 — pior que o esperado',
            '−2 — muito pior que o esperado',
          ]}
        />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="M" titulo="Mensurável" sub="O que e em que unidade você vai medir?" />
      <Tip
        titulo="Critérios pra uma boa métrica"
        perguntas={[
          'Existe uma unidade clara que dá pra contar (semanal, diária, escala 0-10)?',
          'Você consegue medir esse valor SEM IA, sem instrumento caro?',
          'O paciente pode reportar com facilidade (entre sessões)?',
        ]}
        exemplo="ataques/semana · min de respiração diafragmática/dia · horas de sono por noite"
      />

      <Field label="Unidade">
        <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="ex: ataques/semana" />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Baseline (valor atual)">
          <input value={baseline} onChange={e => setBaseline(e.target.value)} placeholder="ex: 3" inputMode="decimal" />
        </Field>
        <Field label="Alvo">
          <input value={alvo} onChange={e => setAlvo(e.target.value)} placeholder="ex: 0" inputMode="decimal" />
        </Field>
      </div>

      {direcaoSugerida && (
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'rgba(90,158,138,.08)', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55,
        }}>
          Direção do progresso: <strong>{direcaoSugerida === 'aumentar' ? 'aumentar' : 'reduzir'}</strong> {unidade || 'a métrica'}
          {' '}— isto é, progredir significa {direcaoSugerida === 'aumentar' ? 'subir' : 'descer'} em direção ao alvo.
        </div>
      )}
    </div>
  )
}

function PassoA({ subPassos, onChange }: { subPassos: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="A" titulo="Atingível" sub="Esse objetivo é realista pra esse paciente, neste momento?" />
      <Tip
        cor="amber"
        titulo="Mapear o caminho até o alvo"
        perguntas={[
          'Que sub-passos compõem esse objetivo? (quebrar em pedaços pequenos)',
          'Quais recursos o paciente já tem (rede de apoio, habilidades, tempo)?',
          'Que obstáculos previsíveis podem aparecer e como antecipar?',
          'O salto entre baseline e alvo é ambicioso ou desproporcional?',
        ]}
        exemplo="1) Mapear gatilhos de saída • 2) Praticar respiração antes de sair • 3) Sair acompanhada uma vez por semana • Obstáculo: dia de chuva piora ansiedade."
      />
      <textarea
        autoFocus
        rows={5}
        value={subPassos}
        onChange={e => onChange(e.target.value)}
        placeholder="Plano de ação, sub-passos, recursos disponíveis, possíveis obstáculos (opcional)"
        className="inp-lg"
      />
      <style jsx>{`
        .inp-lg {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
          resize: vertical; line-height: 1.55;
        }
        .inp-lg:focus { border-color: var(--accent); }
      `}</style>
    </div>
  )
}

function PassoT({ prazo, onChange }: { prazo: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="T" titulo="Temporal" sub="Em quanto tempo você espera atingir esse objetivo? (opcional)" />
      <Tip
        titulo="Definir um prazo realista (opcional)"
        perguntas={[
          'O prazo é compatível com o ritmo terapêutico desse paciente?',
          'Curto demais (gera frustração) ou longo demais (perde tração)?',
          'Quantas sessões cabem nesse período?',
        ]}
        exemplo="Prazo de 8–12 semanas costuma cobrir 1 ciclo terapêutico breve. Pra mudanças estruturais, considerar 4–6 meses."
      />
      <Field label="Data alvo">
        <input type="date" value={prazo} onChange={e => onChange(e.target.value)} className="inp-lg" />
      </Field>
      <style jsx>{`
        .inp-lg {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
        }
        .inp-lg:focus { border-color: var(--accent); }
      `}</style>
    </div>
  )
}

function Revisao(p: {
  tipo: MetricaTipo
  titulo: string
  descricao: string
  unidade: string
  baseline: string
  alvo: string
  direcao: MetricaDirecao
  subPassos: string
  prazo: string
}) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HeaderPasso letra="✓" titulo="Revisão" sub="Confira antes de criar. Você poderá editar e registrar medições depois." />

      <div style={{
        padding: '18px 20px', borderRadius: 10,
        background: 'var(--surface)', display: 'grid', gap: 14,
      }}>
        <RevisaoLinha letra="S" titulo="Específico" valor={p.titulo || '—'} />
        {p.descricao && <RevisaoLinha letra="R" titulo="Relevante" valor={p.descricao} multiLinha />}
        {p.tipo === 'absoluta' ? (
          <RevisaoLinha
            letra="M"
            titulo="Mensurável"
            valor={`${p.unidade || '—'} · de ${p.baseline || '—'} para ${p.alvo || '—'} (${p.direcao === 'aumentar' ? 'aumentar' : 'reduzir'})`}
          />
        ) : (
          <RevisaoLinha letra="·" titulo="Método" valor="Objetivo Terapêutico Simples · preenchimento livre. Acompanhe com escalas GAS na tela da meta, se quiser (opcional)." />
        )}
        {p.subPassos && <RevisaoLinha letra="A" titulo="Atingível · plano" valor={p.subPassos} multiLinha />}
        <RevisaoLinha letra="T" titulo="Temporal" valor={p.prazo ? formatPrazo(p.prazo) : '—'} />
      </div>
    </div>
  )
}

function RevisaoLinha({ letra, titulo, valor, multiLinha }: { letra: string; titulo: string; valor: string; multiLinha?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '36px 1fr', alignItems: 'start' }}>
      <span style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'rgba(106,78,200,.12)', color: '#391d96',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>{letra}</span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{titulo}</div>
        <div style={{
          fontSize: 13, color: 'var(--ink)', lineHeight: 1.55,
          whiteSpace: multiLinha ? 'pre-wrap' : 'normal',
        }}>{valor}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      <style jsx>{`
        :global(input) {
          width: 100%; padding: 11px 14px; border-radius: 10px;
          border: 1px solid var(--border); background: white;
          font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
        }
        :global(input:focus) { border-color: var(--accent); }
      `}</style>
    </label>
  )
}

function formatPrazo(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}
