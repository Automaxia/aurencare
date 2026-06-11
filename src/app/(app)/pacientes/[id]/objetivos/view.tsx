'use client'

import { useState } from 'react'
import type { Objetivo, MetricaTipo, MetricaDirecao, EvolucaoObjetivo } from '@/server/services/objetivos'
import {
  criarObjetivoAction, atualizarObjetivoAction, deletarObjetivoAction,
  registrarMedicaoAction, deletarMedicaoAction, lerEvolucaoAction,
} from './actions'
import { BulletChart } from './BulletChart'
import { NovoObjetivoWizard } from './NovoObjetivoWizard'
import { GasManager } from './GasManager'
import type { GasEscala } from '@/server/services/gasObjetivos'
import { MarcosProgresso } from './MarcosProgresso'
import type { NotaProgresso } from '@/server/services/notasObjetivos'
import { estadoObjetivo, ESTADO_META, prazoEstado, haQuanto } from '@/lib/objetivos'
import { Sparkline } from './Sparkline'

export function ObjetivosView({ pacienteId, initial, valoresIniciais, observacoes, sugestoes, gasInicial, notasInicial }: { pacienteId: string; initial: Objetivo[]; valoresIniciais: Record<string, number[]>; observacoes: Record<string, string>; sugestoes: { titulo: string; tema: string }[]; gasInicial: Record<string, GasEscala[]>; notasInicial: Record<string, NotaProgresso[]> }) {
  const [objs, setObjs] = useState(initial)
  const [gasMap, setGasMap] = useState(gasInicial)
  const [notasMap, setNotasMap] = useState(notasInicial)
  const [showForm, setShowForm] = useState(false)
  const [tituloSugerido, setTituloSugerido] = useState('')

  function onGasChange(objId: string, escalas: GasEscala[]) {
    setGasMap(prev => ({ ...prev, [objId]: escalas }))
  }
  function onNotasChange(objId: string, notas: NotaProgresso[]) {
    setNotasMap(prev => ({ ...prev, [objId]: notas }))
  }

  function abrirComTitulo(t: string) { setTituloSugerido(t); setShowForm(true) }

  function upsert(o: Objetivo) {
    setObjs(prev => {
      const i = prev.findIndex(x => x.id === o.id)
      return i >= 0 ? prev.map(x => x.id === o.id ? o : x) : [o, ...prev]
    })
  }

  async function updateStatus(o: Objetivo, s: Objetivo['status']) {
    const upd = await atualizarObjetivoAction(o.id, { status: s })
    if (upd) upsert(upd)
  }
  async function remover(o: Objetivo) {
    // Confirmação é feita inline no card (sim/não).
    await deletarObjetivoAction(o.id)
    setObjs(prev => prev.filter(x => x.id !== o.id))
  }

  const ativos     = objs.filter(o => o.status === 'ativo')
  const pausados   = objs.filter(o => o.status === 'pausado')
  const concluidos = objs.filter(o => o.status === 'concluido')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn primary" onClick={() => { if (!showForm) setTituloSugerido(''); setShowForm(s => !s) }}>
          {showForm ? 'Fechar' : '+ Nova meta'}
        </button>
      </div>

      {showForm && (
        <NovoObjetivoWizard
          pacienteId={pacienteId}
          tituloInicial={tituloSugerido}
          onCriado={(o, gas) => {
            upsert(o)
            if (gas) setGasMap(prev => ({ ...prev, [o.id]: [...(prev[o.id] ?? []), gas] }))
            setShowForm(false)
          }}
          onCancelar={() => setShowForm(false)}
        />
      )}

      <Section title="Ativos" items={ativos} valores={valoresIniciais} observacoes={observacoes} gas={gasMap} notas={notasMap} onStatus={updateStatus} onDelete={remover} onUpsert={upsert} onGasChange={onGasChange} onNotasChange={onNotasChange} />
      {pausados.length > 0   && <Section title="Pausados"  items={pausados}   valores={valoresIniciais} observacoes={observacoes} gas={gasMap} notas={notasMap} onStatus={updateStatus} onDelete={remover} onUpsert={upsert} onGasChange={onGasChange} onNotasChange={onNotasChange} />}
      {concluidos.length > 0 && <Section title="Concluídos" items={concluidos} valores={valoresIniciais} observacoes={observacoes} gas={gasMap} notas={notasMap} onStatus={updateStatus} onDelete={remover} onUpsert={upsert} onGasChange={onGasChange} onNotasChange={onNotasChange} />}

      {objs.length === 0 && !showForm && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Nenhum objetivo ainda — mas dá pra partir de algo.</div>
          {sugestoes.length > 0 ? (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                A Audere observou estes temas nas suas sessões. São <strong>sugestões de partida</strong> — não criam nada sozinhas:
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {sugestoes.map(s => (
                  <div key={s.titulo} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13 }}>🎯 {s.titulo}</span>
                    <button className="btn ghost sm" onClick={() => abrirComTitulo(s.titulo)}>Transformar em objetivo SMART →</button>
                  </div>
                ))}
              </div>
              <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => abrirComTitulo('')}>+ Criar objetivo do zero</button>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Conforme você assina sessões com transcrição, a Audere passa a sugerir objetivos a partir dos temas observados. Ou crie um agora com <strong>+ Novo objetivo SMART</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Lista ─────────────────────────────────────────────────────────────

function Section({ title, items, valores, observacoes, gas, notas, onStatus, onDelete, onUpsert, onGasChange, onNotasChange }: {
  title: string
  items: Objetivo[]
  valores: Record<string, number[]>
  observacoes: Record<string, string>
  gas: Record<string, GasEscala[]>
  notas: Record<string, NotaProgresso[]>
  onStatus: (o: Objetivo, s: Objetivo['status']) => void
  onDelete: (o: Objetivo) => void
  onUpsert: (o: Objetivo) => void
  onGasChange: (objId: string, escalas: GasEscala[]) => void
  onNotasChange: (objId: string, notas: NotaProgresso[]) => void
}) {
  if (items.length === 0) return null
  // Conta quantos estão "no alvo" (progresso ≥ 100%)
  const noAlvo = items.filter(o => o.progresso >= 100).length
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {title}
        </span>
        {title === 'Ativos' && items.length > 0 && (
          <span style={{ fontSize: 11, color: noAlvo > 0 ? 'var(--sage)' : 'var(--faint)' }}>
            {noAlvo} de {items.length} no alvo
          </span>
        )}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
        {items.map(o => <ObjetivoCard key={o.id} o={o} valores={valores[o.id] ?? []} observacao={observacoes[o.id]} gas={gas[o.id] ?? []} notas={notas[o.id] ?? []} onStatus={onStatus} onDelete={onDelete} onUpsert={onUpsert} onGasChange={onGasChange} onNotasChange={onNotasChange} />)}
      </ul>
    </section>
  )
}

function ObjetivoCard({ o, valores, observacao, gas, notas, onStatus, onDelete, onUpsert, onGasChange, onNotasChange }: {
  o: Objetivo
  valores: number[]
  observacao?: string
  gas: GasEscala[]
  notas: NotaProgresso[]
  onStatus: (o: Objetivo, s: Objetivo['status']) => void
  onDelete: (o: Objetivo) => void
  onUpsert: (o: Objetivo) => void
  onGasChange: (objId: string, escalas: GasEscala[]) => void
  onNotasChange: (objId: string, notas: NotaProgresso[]) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const [evolucao, setEvolucao] = useState<EvolucaoObjetivo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [confirma, setConfirma] = useState<{ texto: string; perigo?: boolean; run: () => void } | null>(null)

  async function carregar() {
    if (evolucao) return
    setCarregando(true)
    const e = await lerEvolucaoAction(o.id)
    setEvolucao(e)
    setCarregando(false)
  }
  function toggle() {
    if (!expandido) carregar()
    setExpandido(e => !e)
  }

  // Última medição = valor atual; penúltima = delta
  const ultima = evolucao?.medicoes?.[evolucao.medicoes.length - 1]?.valor ?? null
  const penultima = evolucao && evolucao.medicoes.length >= 2
    ? evolucao.medicoes[evolucao.medicoes.length - 2].valor
    : null
  // No card sem evolução carregada, fallback: usa progresso (0..100) traduzido pra um valor estimado
  // se ele expandir, recarrega com medições reais.
  const atualEstimado = ultima ?? estimarAtualPorProgresso(o)
  // Delta só faz sentido se há pelo menos duas medições reais
  // Direção do delta: positivo = melhor (na direção da meta), negativo = pior
  const delta = ultima != null && penultima != null
    ? deltaNaDirecao(penultima, ultima, o.metricaDirecao)
    : null

  // Sinal direcional pra header (↑ aumentar / ↓ diminuir)
  const setaDirecao = o.metricaDirecao === 'aumentar' ? '↑' : '↓'

  const estado = estadoObjetivo(o)
  const meta = ESTADO_META[estado]
  const prazo = prazoEstado(o.prazoEm)

  return (
    <li className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span>{o.titulo}</span>
            <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>
              {o.metricaTipo === 'absoluta'
                ? `${setaDirecao} ${o.metricaUnidade ?? 'sem unidade'}`
                : o.metricaTipo === 'gas' ? 'GAS' : 'simples'}
              {gas.length > 0 && ` · ${gas.length} GAS`}
            </span>
          </div>
          {o.descricao && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{o.descricao}</div>
          )}
          <div style={{ fontSize: 11, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {prazo && <span style={{ color: prazo.cor }}>{prazo.texto}</span>}
            {o.status === 'ativo' && <span style={{ color: 'var(--faint)' }}>atualizado {haQuanto(o.updatedAt)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 11, flexShrink: 0 }}>
          <span style={{ padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.cor, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {meta.emoji} {meta.label}
          </span>
          {confirma ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11.5, color: confirma.perigo ? 'var(--rose)' : 'var(--ink-soft)', fontWeight: 500 }}>{confirma.texto}</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button style={acaoBtn('var(--muted)')} onClick={() => setConfirma(null)}>Não</button>
                <button style={acaoBtn(confirma.perigo ? 'var(--rose)' : 'var(--sage)', true)} onClick={() => { confirma.run(); setConfirma(null) }}>Sim</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 5 }}>
              {o.status !== 'concluido' && (
                <button style={acaoBtn('var(--sage)')} onClick={() => setConfirma({ texto: 'Concluir esta meta?', run: () => onStatus(o, 'concluido') })}>✓ Concluir</button>
              )}
              {o.status === 'ativo' && (
                <button style={acaoBtn('var(--amber)')} onClick={() => setConfirma({ texto: 'Pausar esta meta?', run: () => onStatus(o, 'pausado') })}>Pausar</button>
              )}
              {o.status !== 'ativo' && (
                <button style={acaoBtn('var(--accent)')} onClick={() => setConfirma({ texto: 'Reativar esta meta?', run: () => onStatus(o, 'ativo') })}>Reativar</button>
              )}
              <button style={acaoBtn('var(--rose)')} title="Remover" onClick={() => setConfirma({ texto: 'Remover esta meta? Não dá pra desfazer.', perigo: true, run: () => onDelete(o) })}>✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Progresso — bullet chart (métrica numérica) ou slider manual (objetivo simples) */}
      {o.metricaBaseline != null && o.metricaAlvo != null ? (
        <BulletChart
          baseline={o.metricaBaseline}
          alvo={o.metricaAlvo}
          atual={atualEstimado}
          direcao={o.metricaDirecao}
          tipo={o.metricaTipo}
          unidade={null}
          delta={delta}
        />
      ) : o.metricaTipo === 'nenhuma' ? (
        <ProgressoSlider objetivoId={o.id} valor={o.progresso} onSalvo={onUpsert} />
      ) : null}

      {/* Sparkline de tendência — medições no tempo (Fase 2) */}
      {(() => {
        const serie = evolucao?.medicoes?.length ? evolucao.medicoes.map(m => m.valor) : valores
        return serie.length >= 2 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>tendência</span>
            <Sparkline valores={serie} direcao={o.metricaDirecao} />
          </div>
        ) : null
      })()}

      {observacao && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 12,
          padding: '8px 11px', borderRadius: 8, background: 'var(--accent-lo)',
          fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45,
        }}>
          <span aria-hidden="true">💡</span>
          <span>{observacao}</span>
        </div>
      )}

      <button onClick={toggle} className="btn ghost sm" style={{ marginTop: 14, padding: '4px 10px', fontSize: 11 }}>
        {expandido ? '▲ Fechar histórico' : '▼ Registrar / ver histórico'}
      </button>

      {expandido && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {carregando && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Carregando…</div>}
          {evolucao && o.metricaTipo === 'absoluta' && (
            <EvolucaoPanel
              evolucao={evolucao}
              onMudou={(nova) => {
                setEvolucao(nova)
                if (nova.objetivo) onUpsert(nova.objetivo)
              }}
            />
          )}

          {/* Marcos de progresso — anotações livres (ambos os métodos) */}
          <MarcosProgresso objetivoId={o.id} notas={notas} onChange={(n) => onNotasChange(o.id, n)} />

          {/* GAS — acompanhamento da meta (opcional, múltiplo) */}
          <GasManager objetivoId={o.id} escalas={gas} onChange={(e) => onGasChange(o.id, e)} />
        </div>
      )}
    </li>
  )
}

/**
 * Quando o card carrega sem ter buscado medições ainda, reconstrói um valor
 * aproximado a partir do `progresso` (0..100) salvo no objetivo. Isso evita
 * pular renderização do bullet chart no card colapsado.
 */
function estimarAtualPorProgresso(o: Objetivo): number | null {
  if (o.metricaBaseline == null || o.metricaAlvo == null) return null
  if (o.progresso === 0) return o.metricaBaseline
  const frac = o.progresso / 100
  const delta = (o.metricaAlvo - o.metricaBaseline) * frac
  return o.metricaBaseline + delta
}

/**
 * Delta "na direção da meta": positivo = melhorou, negativo = piorou.
 * Para metas de "diminuir", a melhoria é o decréscimo.
 */
function deltaNaDirecao(anterior: number, atual: number, dir: 'aumentar' | 'diminuir'): number {
  return dir === 'aumentar' ? (atual - anterior) : (anterior - atual)
}

/** Slider de progresso 0–100 para objetivos simples (sem métrica numérica).
 *  O psicólogo arrasta pra marcar o andamento; salva ao soltar. */
function ProgressoSlider({ objetivoId, valor, onSalvo }: { objetivoId: string; valor: number; onSalvo: (o: Objetivo) => void }) {
  const [v, setV] = useState(valor)
  const [estado, setEstado] = useState<'idle' | 'salvando' | 'ok'>('idle')

  async function salvar() {
    if (v === valor) return
    setEstado('salvando')
    const o = await atualizarObjetivoAction(objetivoId, { progresso: v })
    if (o) { onSalvo(o); setEstado('ok'); setTimeout(() => setEstado('idle'), 1500) }
    else setEstado('idle')
  }

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Progresso</span>
        <span style={{ fontFamily: 'var(--f-display)', fontSize: 20, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
          {v}%
          {estado === 'salvando' && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>salvando…</span>}
          {estado === 'ok' && <span style={{ fontSize: 11, color: 'var(--sage)', marginLeft: 8 }}>✓ salvo</span>}
        </span>
      </div>
      <input
        type="range" min={0} max={100} step={5} value={v}
        onChange={e => setV(Number(e.target.value))}
        onPointerUp={salvar} onKeyUp={salvar}
        aria-label="Progresso do objetivo"
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  )
}

/** Botão de ação do card — mais destaque que o ghost: borda + leve preenchimento
 *  na cor. `solido` = preenchimento mais forte (usado no "Sim" da confirmação). */
function acaoBtn(cor: string, solido = false): React.CSSProperties {
  return {
    fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 7,
    border: `1px solid color-mix(in srgb, ${cor} 38%, transparent)`,
    background: `color-mix(in srgb, ${cor} ${solido ? 18 : 9}%, transparent)`,
    color: cor, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2,
    fontFamily: 'inherit',
  }
}

// ─── Painel de evolução ───────────────────────────────────────────────

function EvolucaoPanel({ evolucao, onMudou }: { evolucao: EvolucaoObjetivo; onMudou: (e: EvolucaoObjetivo) => void }) {
  const { objetivo, medicoes } = evolucao
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    const v = parseFloat(valor.replace(',', '.'))
    if (isNaN(v)) { setErro('Valor inválido.'); return }
    if (objetivo.metricaTipo === 'gas' && (v < -2 || v > 2)) { setErro('GAS aceita apenas valores entre -2 e +2.'); return }
    setSalvando(true)
    const m = await registrarMedicaoAction(objetivo.id, { medidoEm: data, valor: v, nota: nota.trim() || null })
    setSalvando(false)
    if (!m) { setErro('Não foi possível salvar.'); return }
    const fresh = await lerEvolucaoAction(objetivo.id)
    if (fresh) onMudou(fresh)
    setValor(''); setNota('')
  }

  async function remover(medicaoId: string) {
    if (!confirm('Remover essa medição?')) return
    await deletarMedicaoAction(medicaoId, objetivo.id)
    const fresh = await lerEvolucaoAction(objetivo.id)
    if (fresh) onMudou(fresh)
  }

  // Última e penúltima pra delta
  const ultima = medicoes[medicoes.length - 1]?.valor ?? null
  const penultima = medicoes.length >= 2 ? medicoes[medicoes.length - 2].valor : null
  const delta = ultima != null && penultima != null
    ? deltaNaDirecao(penultima, ultima, objetivo.metricaDirecao)
    : null

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Bullet chart maior */}
      <BulletChart
        baseline={objetivo.metricaBaseline}
        alvo={objetivo.metricaAlvo}
        atual={ultima}
        direcao={objetivo.metricaDirecao}
        tipo={objetivo.metricaTipo}
        unidade={objetivo.metricaUnidade}
        delta={delta}
        size="lg"
      />

      {/* Form de medição */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--rsm)',
        padding: 12, display: 'grid', gap: 10,
      }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Registrar medição
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
          <Inp label="Data" value={data} onChange={setData} placeholder="" />
          <Inp
            label={objetivo.metricaTipo === 'gas' ? 'GAS' : `Valor${objetivo.metricaUnidade ? ' · ' + objetivo.metricaUnidade : ''}`}
            value={valor} onChange={setValor}
            placeholder={objetivo.metricaTipo === 'gas' ? '-2 a +2' : ''}
          />
          <Inp label="Nota (opcional)" value={nota} onChange={setNota} placeholder="" />
          <button type="button" className="btn primary" onClick={adicionar} disabled={salvando} style={{ height: 36 }}>
            {salvando ? '…' : '+ Registrar'}
          </button>
        </div>
        {erro && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}
      </div>

      {/* Lista de medições */}
      {medicoes.length > 0 && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Histórico
            </span>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>
              {medicoes.length} medi{medicoes.length === 1 ? 'ção' : 'ções'}
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
            {[...medicoes].reverse().map((m, idx, arr) => {
              const proxAtras = arr[idx + 1]?.valor ?? null
              const d = proxAtras != null
                ? deltaNaDirecao(proxAtras, m.valor, objetivo.metricaDirecao)
                : null
              return (
                <li key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 10px', background: 'var(--surface)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>{formatDataCurta(m.medidoEm)}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500, minWidth: 50, fontVariantNumeric: 'tabular-nums' }}>{formatNum(m.valor)}</span>
                  {d != null && d !== 0 && (
                    <span style={{ color: d > 0 ? 'var(--sage)' : 'var(--rose)', fontSize: 11 }}>
                      {d > 0 ? '↑' : '↓'} {formatNum(Math.abs(d))}
                    </span>
                  )}
                  {m.nota && <span style={{ color: 'var(--muted)', flex: 1 }}>{m.nota}</span>}
                  {!m.nota && <span style={{ flex: 1 }} />}
                  <button onClick={() => remover(m.id)} className="btn ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--rose)' }}>×</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')
}
function formatPrazo(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatDataCurta(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Inp({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'grid', gap: 3 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        inputMode="decimal"
        style={{
          padding: '9px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'white',
          fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
        }}
      />
    </label>
  )
}
