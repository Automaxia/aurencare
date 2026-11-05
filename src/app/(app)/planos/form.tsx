'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { formatBRL, formatDateBR } from '@/lib/formatters'
import { assinarAction, cancelarAction, pagarFaturaAction, simularTrocaAction } from './actions'

type Simulacao = NonNullable<Awaited<ReturnType<typeof simularTrocaAction>>>

// Public key da Pagar.me (inlinada pelo Next em build). Se ausente, o checkout
// roda em modo demonstração (sem cartão real).
const PAGARME_PK = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY

/** Tokeniza o cartão direto na Pagar.me (token de uso único, 60s). O PAN nunca
 *  passa pelo nosso backend — vai só pra Pagar.me com a public key no appId. */
async function tokenizeCard(pk: string, card: {
  number: string; holder: string; expMonth: string; expYear: string; cvv: string
}): Promise<string> {
  const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(pk)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: card.number.replace(/\D/g, ''),
        holder_name: card.holder.trim(),
        exp_month: card.expMonth.replace(/\D/g, ''),
        exp_year: card.expYear.replace(/\D/g, ''),
        cvv: card.cvv.replace(/\D/g, ''),
      },
    }),
  })
  if (!res.ok) throw new Error('tokenize_failed')
  const json = await res.json()
  if (!json?.id) throw new Error('tokenize_no_id')
  return json.id as string
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: 13, color: 'var(--ink)',
}

type PlanoKey = 'free' | 'essencial' | 'pro'
type Ciclo = 'mensal' | 'anual'

type PlanoConfig = {
  nome: string
  capSessoesIa: number
  precoMensalCentavos: number
  precoAnualCentavos: number | null
  destaque?: boolean
}

type Props = {
  planos: Record<PlanoKey, PlanoConfig>
  atual: {
    plano: PlanoKey
    status: 'ativo' | 'inadimplente' | 'cancelado'
    ciclo: Ciclo | null
    expiraEm: string | null
    cap: number
    usadas: number
    restantes: number
    cortesiaAte: string | null
    /** Gateway da assinatura ATUAL (null = sem assinatura). */
    gateway: 'pagarme' | 'asaas' | null
    /** Troca agendada para a renovação. */
    agendado: { plano: Exclude<PlanoKey, 'free'>; ciclo: Ciclo; em: string | null } | null
  }
  mock: boolean
  beta: boolean
  /** Gateway das NOVAS assinaturas. asaas = paga na fatura do Asaas (sem cartão aqui). */
  gateway: 'pagarme' | 'asaas'
  /** Plano escolhido na vitrine pública, herdado via `/planos?plano=&ciclo=`. */
  pre?: { plano: Exclude<PlanoKey, 'free'>; ciclo: Ciclo } | null
}

const ORDEM: PlanoKey[] = ['free', 'essencial', 'pro']

export function PlanosForm({ planos, atual, mock, beta, pre, gateway }: Props) {
  const router = useRouter()
  // checkout real exige tanto a public key (tokenizar no front) quanto a
  // secret key (criar a assinatura no back). Faltando uma, cai no modo demo.
  // Asaas: sem formulário de cartão — o botão leva à fatura do Asaas (D-04).
  const faturaAsaas = gateway === 'asaas' && !mock
  const realCheckout = gateway === 'pagarme' && !!PAGARME_PK && !mock

  const [ciclo, setCiclo] = useState<Ciclo>(pre?.ciclo ?? atual.ciclo ?? 'mensal')
  const [pending, setPending] = useState<PlanoKey | 'cancel' | 'fatura' | null>(null)
  // Já assina (pagando): os botões trocam o plano no mesmo cartão — "Mudar para",
  // não "Assinar", que dá a entender uma cobrança nova do zero.
  const assinante = atual.plano !== 'free' && atual.status === 'ativo' && !atual.cortesiaAte
  // Asaas com fatura em aberto: o caminho é pagar ESSA fatura, não assinar de novo.
  const faturaPendente = atual.status === 'inadimplente' && atual.gateway === 'asaas'
  // Troca no mesmo cartão aguardando confirmação (prévia do valor/data).
  const [troca, setTroca] = useState<{ plano: Exclude<PlanoKey, 'free'>; ciclo: Ciclo; sim: Simulacao } | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  // plano escolhido aguardando dados do cartão (só no fluxo real, com public key).
  // Quem chegou da vitrine já cai com o painel de cartão aberto — a pessoa não
  // deveria ter que escolher o plano duas vezes.
  const [escolhido, setEscolhido] = useState<Exclude<PlanoKey, 'free'> | null>(
    pre && realCheckout && !beta ? pre.plano : null,
  )
  const [card, setCard] = useState({ number: '', holder: '', expMonth: '', expYear: '', cvv: '' })
  const [processando, setProcessando] = useState(false)

  const pctUso = atual.cap > 0 ? Math.min(100, Math.round((atual.usadas / atual.cap) * 100)) : 0

  async function assinar(plano: PlanoKey) {
    if (plano === 'free' || beta) return
    setMsg(null)
    const destino = plano as Exclude<PlanoKey, 'free'>
    // Já assina no mesmo cartão: mostra quanto entra na fatura e quando vale ANTES.
    if (assinante) {
      setPending(plano)
      const sim = await simularTrocaAction({ plano: destino, ciclo }).catch(() => null)
      setPending(null)
      if (sim) { setTroca({ plano: destino, ciclo, sim }); return }
    }
    if (realCheckout) { setEscolhido(destino); return }   // abre o painel de cartão
    // Asaas: cria a assinatura e manda para a fatura. Sem public key (Pagar.me):
    // modo demonstração — assina direto (assinatura mock no backend).
    await executarAssinatura(destino, ciclo)
  }

  async function executarAssinatura(plano: Exclude<PlanoKey, 'free'>, ciclo: Ciclo, textoOk?: string) {
    setPending(plano)
    const r = await assinarAction({ plano, ciclo })
    setPending(null)
    setTroca(null)
    if (r.ok && r.urlPagamento) { window.location.href = r.urlPagamento; return }
    if (r.ok && textoOk) { setMsg({ tipo: 'ok', texto: textoOk }); router.refresh(); return }
    if (r.ok) {
      setMsg({ tipo: 'ok', texto: 'Plano atualizado!' })
      router.refresh()
    } else setMsg({ tipo: 'erro', texto: r.error })
  }

  async function confirmarPagamento() {
    if (!escolhido || !PAGARME_PK) return
    if (card.number.replace(/\D/g, '').length < 13 || card.holder.trim().length < 3
        || card.expMonth.length < 1 || card.expYear.length < 2 || card.cvv.length < 3) {
      setMsg({ tipo: 'erro', texto: 'Confira os dados do cartão.' }); return
    }
    setProcessando(true); setMsg(null)
    let token: string
    try {
      token = await tokenizeCard(PAGARME_PK, card)
    } catch {
      setProcessando(false)
      setMsg({ tipo: 'erro', texto: 'Não foi possível validar o cartão. Confira os dados e tente novamente.' })
      return
    }
    const r = await assinarAction({ plano: escolhido, ciclo, cardToken: token })
    setProcessando(false)
    if (r.ok) {
      setEscolhido(null)
      setCard({ number: '', holder: '', expMonth: '', expYear: '', cvv: '' })
      setMsg({ tipo: 'ok', texto: 'Plano atualizado!' }); router.refresh()
    } else setMsg({ tipo: 'erro', texto: r.error })
  }

  async function pagarFatura() {
    setPending('fatura'); setMsg(null)
    const r = await pagarFaturaAction()
    setPending(null)
    if (r.ok && r.urlPagamento) { window.location.href = r.urlPagamento; return }
    if (!r.ok) setMsg({ tipo: 'erro', texto: r.error })
  }

  async function cancelar() {
    if (!confirm('Cancelar a assinatura? Você mantém o acesso até o fim do período já pago.')) return
    setPending('cancel'); setMsg(null)
    const r = await cancelarAction()
    setPending(null)
    if (r.ok) { setMsg({ tipo: 'ok', texto: 'Assinatura cancelada. Acesso mantido até o fim do ciclo.' }); router.refresh() }
    else setMsg({ tipo: 'erro', texto: r.error })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Beta: acesso liberado · ou medidor de uso do mês ── */}
      {beta ? (
        <div style={{ background: 'rgba(90,158,138,.10)', border: '1px solid rgba(90,158,138,.25)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2a6456', marginBottom: 4 }}>
            Beta · acesso completo liberado
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            Durante o beta, você usa a Audere <strong>sem limite e sem mensalidade</strong>.
            Os planos abaixo são uma prévia do que virá quando a cobrança começar — avisaremos antes.
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Sessões com IA este mês — plano <strong>{planos[atual.plano].nome}</strong>
              {atual.status === 'inadimplente' && <span style={{ color: 'var(--rose)' }}> · pagamento pendente</span>}
              {atual.status === 'cancelado' && <span style={{ color: 'var(--amber)' }}> · cancelado</span>}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: atual.restantes === 0 ? 'var(--rose)' : 'var(--ink)' }}>
              {atual.usadas}/{atual.cap}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ width: `${pctUso}%`, height: '100%', background: atual.restantes === 0 ? 'var(--rose)' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
            {atual.restantes > 0
              ? `${atual.restantes} sessões com IA restantes neste ciclo.`
              : 'Limite atingido — o registro com IA volta no próximo ciclo. Agenda e prontuário seguem normais.'}
            {/* Cancelada/inadimplente não renova — vence. Dizer "Renova em"
                nesse estado é promessa falsa: naquela data o acesso CAI. */}
            {!atual.cortesiaAte && atual.expiraEm && atual.plano !== 'free' && (
              atual.status === 'ativo'
                ? ` Renova em ${formatDateBR(atual.expiraEm)}.`
                : ` Acesso até ${formatDateBR(atual.expiraEm)} — depois a conta volta ao Free.`
            )}
          </div>

          {atual.agendado && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                Troca agendada: <strong>{planos[atual.agendado.plano].nome}</strong>
                {atual.agendado.ciclo !== atual.ciclo && ` (${atual.agendado.ciclo})`}
                {atual.agendado.em ? ` a partir de ${formatDateBR(`${atual.agendado.em}T12:00:00-03:00`)}` : ' na próxima renovação'}.
                Até lá você segue no {planos[atual.plano].nome}.
              </span>
              <button className="btn ghost sm" disabled={pending !== null}
                onClick={() => executarAssinatura(atual.plano as Exclude<PlanoKey, 'free'>, atual.ciclo ?? 'mensal',
                  `Troca cancelada — você segue no ${planos[atual.plano].nome}.`)}>
                {pending === atual.plano ? 'Cancelando…' : `Manter ${planos[atual.plano].nome}`}
              </button>
            </div>
          )}

          {faturaPendente && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                A fatura da assinatura está em aberto. Pague para liberar o plano — o cartão fica salvo no Asaas para as próximas renovações.
              </span>
              <button className="btn primary sm" onClick={pagarFatura} disabled={pending !== null}>
                {pending === 'fatura' ? 'Abrindo…' : 'Pagar fatura'}
              </button>
            </div>
          )}

          {/* Cortesia do beta: a data precisa aparecer, senão o rebaixamento
              daqui a um ano chega como surpresa. */}
          {atual.cortesiaAte && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              <strong style={{ color: '#2a6456' }}>Cortesia do beta</strong> — você usa o plano{' '}
              {planos[atual.plano].nome} sem pagar até <strong>{formatDateBR(atual.cortesiaAte)}</strong>.
              Obrigado por ter entrado cedo. Depois dessa data a conta volta ao Free (
              {planos.free.capSessoesIa} sessões/mês) se não houver assinatura.
            </div>
          )}
        </div>
      )}

      {/* ── Toggle ciclo (escondido no beta — sem valores ainda) ── */}
      {!beta && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CicloBtn label="Mensal" active={ciclo === 'mensal'} onClick={() => setCiclo('mensal')} />
          <CicloBtn label="Anual · ~12% off" active={ciclo === 'anual'} onClick={() => setCiclo('anual')} />
        </div>
      )}

      {/* ── Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {ORDEM.map(key => {
          const p = planos[key]
          const ehAtual = atual.plano === key
          const mensalCents = key === 'free' ? 0
            : ciclo === 'anual' && p.precoAnualCentavos != null ? Math.round(p.precoAnualCentavos / 12)
            : p.precoMensalCentavos
          return (
            <div key={key} style={{
              background: 'var(--card)',
              border: `1px solid ${p.destaque ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: p.destaque ? '0 4px 18px rgba(106,78,200,.10)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>{p.nome}</span>
                {p.destaque && <span style={{ fontSize: 10, color: '#391d96', background: 'rgba(106,78,200,.12)', padding: '2px 8px', borderRadius: 999 }}>Mais completo</span>}
              </div>

              {beta ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>
                  {key === 'free' ? 'Gratuito' : 'Valor definido no lançamento'}
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{formatBRL(mensalCents, true)}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>/mês</span>
                  {key !== 'free' && ciclo === 'anual' && p.precoAnualCentavos != null && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatBRL(p.precoAnualCentavos, true)} cobrado por ano</div>
                  )}
                </div>
              )}

              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                <strong>{p.capSessoesIa}</strong> sessões com IA/mês
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1 }}>
                Pacientes ilimitados · agenda · prontuário · WhatsApp · pagamentos
                {key !== 'free' && ' · Modo Presença · resumo e risco por IA'}
                {key === 'pro' && ' · Temas e Evolução longitudinal · analytics'}
              </div>

              {beta ? (
                key === 'free'
                  ? <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>—</span>
                  : <button className="btn ghost" disabled style={{ opacity: .7 }}>Em breve</button>
              ) : ehAtual && !(assinante && ciclo !== atual.ciclo) ? (
                <button className="btn ghost" disabled style={{ opacity: .7 }}>Plano atual</button>
              ) : atual.agendado?.plano === key && atual.agendado.ciclo === ciclo ? (
                <button className="btn ghost" disabled style={{ opacity: .7 }}>Agendado</button>
              ) : key === 'free' ? (
                <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>—</span>
              ) : (
                <button className={`btn${p.destaque ? ' primary' : ''}`} onClick={() => assinar(key)} disabled={pending !== null}>
                  {pending === key ? 'Processando…'
                    : assinante ? (ehAtual ? `Mudar para ${ciclo}` : `Mudar para ${p.nome}`)
                    : 'Assinar'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {troca && (() => {
        const { sim } = troca
        const destino = planos[troca.plano]
        const venc = sim.proximaCobranca ? formatDateBR(sim.proximaCobranca) : 'a próxima cobrança'
        const porCiclo = troca.ciclo === 'anual' ? 'ano' : 'mês'
        return (
          <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 14, padding: 20, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
              {sim.tipo === 'upgrade' ? `Mudar para o ${destino.nome} agora` : `Mudar para o ${destino.nome}${troca.ciclo !== atual.ciclo ? ` (${troca.ciclo})` : ''} na renovação`}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
              {sim.tipo === 'upgrade' ? (
                <>
                  O {destino.nome} libera agora, com <strong>{destino.capSessoesIa} sessões com IA</strong> por mês.
                  {sim.acrescimoCentavos > 0 && sim.faturaAvulsa ? (
                    // Próxima cobrança ainda não gerada (ex.: anual): a diferença
                    // sai numa fatura à parte, que abre ao confirmar.
                    <> A diferença proporcional deste ciclo, <strong>{formatBRL(sim.acrescimoCentavos, true)}</strong>, sai
                      numa <strong>fatura à parte</strong>, que abre ao confirmar. A partir de {venc},{' '}
                      <strong>{formatBRL(sim.precoNovoCentavos, true)}</strong>/{porCiclo} no mesmo cartão.</>
                  ) : sim.acrescimoCentavos > 0 ? (
                    <> A diferença proporcional deste ciclo, <strong>{formatBRL(sim.acrescimoCentavos, true)}</strong>, entra
                      na próxima fatura ({venc}) junto com o valor do plano, <strong>{formatBRL(sim.precoNovoCentavos, true)}</strong> —
                      total de <strong>{formatBRL(sim.acrescimoCentavos + sim.precoNovoCentavos, true)}</strong> no mesmo cartão. Nada é cobrado agora.</>
                  ) : (
                    <> A partir de {venc}, <strong>{formatBRL(sim.precoNovoCentavos, true)}</strong>/{porCiclo} no mesmo cartão.</>
                  )}
                  {sim.agendado && <> O ciclo {troca.ciclo} começa na renovação.</>}
                </>
              ) : (
                <>
                  Você segue no {planos[atual.plano].nome} até <strong>{venc}</strong>, como já pagou. A partir daí,
                  {' '}{destino.nome} por <strong>{formatBRL(sim.precoNovoCentavos, true)}</strong>/{porCiclo}, no mesmo cartão.
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={pending !== null}
                onClick={() => executarAssinatura(troca.plano, troca.ciclo, sim.tipo === 'upgrade'
                  ? `Pronto — você está no ${destino.nome}.`
                  : `Troca agendada para ${venc}.`)}>
                {pending === troca.plano ? 'Processando…' : 'Confirmar'}
              </button>
              <button className="btn ghost" onClick={() => setTroca(null)} disabled={pending !== null}>Voltar</button>
            </div>
          </div>
        )
      })()}

      {escolhido && realCheckout && (() => {
        const cfg = planos[escolhido]
        const valor = ciclo === 'anual' && cfg.precoAnualCentavos != null ? cfg.precoAnualCentavos : cfg.precoMensalCentavos
        return (
          <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 14, padding: 20, display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
              Assinar {cfg.nome} — {formatBRL(valor, true)} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>/{ciclo === 'anual' ? 'ano' : 'mês'}</span>
            </div>
            <input style={inputStyle} placeholder="Número do cartão" inputMode="numeric" autoComplete="cc-number"
              value={card.number} onChange={e => setCard({ ...card, number: e.target.value })} />
            <input style={inputStyle} placeholder="Nome impresso no cartão" autoComplete="cc-name"
              value={card.holder} onChange={e => setCard({ ...card, holder: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input style={inputStyle} placeholder="MM" inputMode="numeric" maxLength={2} autoComplete="cc-exp-month"
                value={card.expMonth} onChange={e => setCard({ ...card, expMonth: e.target.value })} />
              <input style={inputStyle} placeholder="AAAA" inputMode="numeric" maxLength={4} autoComplete="cc-exp-year"
                value={card.expYear} onChange={e => setCard({ ...card, expYear: e.target.value })} />
              <input style={inputStyle} placeholder="CVV" inputMode="numeric" maxLength={4} autoComplete="cc-csc"
                value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={confirmarPagamento} disabled={processando}>
                {processando ? 'Processando…' : `Confirmar — ${formatBRL(valor, true)}`}
              </button>
              <button className="btn ghost" onClick={() => { setEscolhido(null); setMsg(null) }} disabled={processando}>Cancelar</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Lock size={12} style={{ flexShrink: 0 }} /> Dados do cartão vão direto e cifrados pra Pagar.me — não passam pelos servidores do Audere.
            </div>
          </div>
        )
      })()}

      {msg && (
        <div style={{ fontSize: 13, color: msg.tipo === 'ok' ? 'var(--sage)' : 'var(--rose)' }}>{msg.texto}</div>
      )}

      {faturaAsaas && !beta && !assinante && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Lock size={12} style={{ flexShrink: 0 }} /> O pagamento é feito na página segura do Asaas — os dados do cartão não passam pelos servidores do Audere. O plano é liberado assim que o pagamento é confirmado.
        </div>
      )}

      {!beta && !realCheckout && !faturaAsaas && (
        <div style={{ fontSize: 11.5, color: 'var(--amber)', background: 'rgba(176,125,64,.10)', padding: '8px 12px', borderRadius: 10 }}>
          ⚠️ Checkout em modo demonstração — a assinatura é simulada (sem cartão real). Configure <code>NEXT_PUBLIC_PAGARME_PUBLIC_KEY</code> (front) e <code>PAGARME_API_KEY</code> (back) pra habilitar o pagamento com cartão.
        </div>
      )}

      {/* Cortesia não tem assinatura pra cancelar — mostrar o botão só levaria
          a pessoa a um erro ("Nenhuma assinatura ativa"). */}
      {atual.plano !== 'free' && atual.status !== 'cancelado' && !atual.cortesiaAte && (
        <button onClick={cancelar} disabled={pending !== null}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
          {pending === 'cancel' ? 'Cancelando…' : 'Cancelar assinatura'}
        </button>
      )}
    </div>
  )
}

function CicloBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
      background: active ? 'rgba(106,78,200,.10)' : 'transparent',
      color: active ? '#391d96' : 'var(--muted)', fontWeight: active ? 500 : 400,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>{label}</button>
  )
}
