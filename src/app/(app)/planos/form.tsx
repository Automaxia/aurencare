'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, formatDateBR } from '@/lib/formatters'
import { assinarAction, cancelarAction } from './actions'

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
  }
  mock: boolean
}

const ORDEM: PlanoKey[] = ['free', 'essencial', 'pro']

export function PlanosForm({ planos, atual, mock }: Props) {
  const router = useRouter()
  const [ciclo, setCiclo] = useState<Ciclo>(atual.ciclo ?? 'mensal')
  const [pending, setPending] = useState<PlanoKey | 'cancel' | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const pctUso = atual.cap > 0 ? Math.min(100, Math.round((atual.usadas / atual.cap) * 100)) : 0

  async function assinar(plano: PlanoKey) {
    if (plano === 'free') return
    setPending(plano); setMsg(null)
    // Em produção real: aqui tokenizamos o cartão (Pagar.me) e passamos cardToken.
    const r = await assinarAction({ plano, ciclo })
    setPending(null)
    if (r.ok) { setMsg({ tipo: 'ok', texto: 'Plano atualizado!' }); router.refresh() }
    else setMsg({ tipo: 'erro', texto: r.error })
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
      {/* ── Uso do mês ── */}
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
          {atual.expiraEm && atual.plano !== 'free' && ` Renova em ${formatDateBR(atual.expiraEm)}.`}
        </div>
      </div>

      {/* ── Toggle ciclo ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CicloBtn label="Mensal" active={ciclo === 'mensal'} onClick={() => setCiclo('mensal')} />
        <CicloBtn label="Anual · ~12% off" active={ciclo === 'anual'} onClick={() => setCiclo('anual')} />
      </div>

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

              <div>
                <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{formatBRL(mensalCents, true)}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>/mês</span>
                {key !== 'free' && ciclo === 'anual' && p.precoAnualCentavos != null && (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatBRL(p.precoAnualCentavos, true)} cobrado por ano</div>
                )}
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                <strong>{p.capSessoesIa}</strong> sessões com IA/mês
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1 }}>
                Pacientes ilimitados · agenda · prontuário · WhatsApp · pagamentos
                {key !== 'free' && ' · Modo Presença · resumo e risco por IA'}
                {key === 'pro' && ' · Temas e Evolução longitudinal · analytics'}
              </div>

              {ehAtual ? (
                <button className="btn ghost" disabled style={{ opacity: .7 }}>Plano atual</button>
              ) : key === 'free' ? (
                <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>—</span>
              ) : (
                <button className={`btn${p.destaque ? ' primary' : ''}`} onClick={() => assinar(key)} disabled={pending !== null}>
                  {pending === key ? 'Processando…' : 'Assinar'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {msg && (
        <div style={{ fontSize: 13, color: msg.tipo === 'ok' ? 'var(--sage)' : 'var(--rose)' }}>{msg.texto}</div>
      )}

      {mock && (
        <div style={{ fontSize: 11.5, color: 'var(--amber)', background: 'rgba(176,125,64,.10)', padding: '8px 12px', borderRadius: 10 }}>
          ⚠️ Checkout em modo demonstração — a assinatura é simulada (sem cartão real). A tokenização de cartão da Pagar.me será plugada quando a chave pública estiver configurada.
        </div>
      )}

      {atual.plano !== 'free' && atual.status !== 'cancelado' && (
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
