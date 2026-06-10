import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { resumoCustos } from '@/server/services/custos'
import { usdParaBrl, USD_BRL } from '@/server/lib/precos'

export const dynamic = 'force-dynamic'

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic (IA)',
  assemblyai: 'AssemblyAI (transcrição)',
}

function brl(usd: number) {
  return usdParaBrl(usd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function usd(v: number) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export default async function CustosPage() {
  await requireRole('admin')
  const r = await resumoCustos()

  const cards = [
    { label: 'Gasto no mês', valor: brl(r.mesTotalUsd), sub: usd(r.mesTotalUsd) },
    { label: 'Total acumulado', valor: brl(r.totalUsd), sub: usd(r.totalUsd) },
    { label: 'Custo médio / sessão', valor: r.custoPorSessaoMesUsd != null ? brl(r.custoPorSessaoMesUsd) : '—', sub: `${r.sessoesMes} sessões c/ IA no mês` },
  ]

  return (
    <div>
      <PageHeader
        title="Custos de API"
        subtitle="Quanto as APIs externas custam — pro modelo de negócio"
        actions={<Link href="/admin" className="btn ghost">← Administração</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, lineHeight: 1.1, marginTop: 4 }}>{c.valor}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <section className="card" style={{ padding: 16 }}>
          <div className="widget-title" style={{ marginBottom: 10 }}>Por provedor (mês)</div>
          {r.porProviderMes.length === 0 ? (
            <Empty />
          ) : r.porProviderMes.map(p => (
            <div key={p.provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                {PROVIDER_LABEL[p.provider] ?? p.provider}
                {p.estimado && <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 6 }}>estimado</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{brl(p.usd)}</span>
            </div>
          ))}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div className="widget-title" style={{ marginBottom: 10 }}>Por operação (mês)</div>
          {r.porOperacaoMes.length === 0 ? (
            <Empty />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
                  <th style={{ padding: '4px 0' }}>Operação</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Chamadas</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Custo</th>
                </tr>
              </thead>
              <tbody>
                {r.porOperacaoMes.map(o => (
                  <tr key={`${o.provider}-${o.operacao}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 0', color: 'var(--ink-soft)' }}>{o.operacao}</td>
                    <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{o.chamadas}</td>
                    <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(o.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--faint)', lineHeight: 1.6, maxWidth: 760 }}>
        Rastreio <strong>a partir de agora</strong>{r.primeiroRegistro ? ` (desde ${new Date(r.primeiroRegistro).toLocaleDateString('pt-BR')})` : ''} —
        o histórico total consolidado fica no console de cada provedor; aqui é o detalhamento por operação/sessão.
        <strong> Anthropic</strong> é preciso (tokens reais); <strong>AssemblyAI</strong> é estimado pela duração da sessão (o streaming é navegador→provedor).
        Câmbio usado: US$ 1 = R$ {USD_BRL.toFixed(2)} (editável em <code>precos.ts</code>).
      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Sem custos registrados ainda — aparece conforme o uso.</div>
}
