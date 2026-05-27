import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerFinanceiro } from '@/server/services/financeiro'
import { formatBRL, formatDateTimeBR } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage({ searchParams }: { searchParams: { mes?: string } }) {
  const user = await requirePsicologo()
  const mesIso = searchParams?.mes ?? new Date().toISOString()
  const f = await lerFinanceiro(user.id, mesIso)

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Cobranças do mês, recebimentos e projeção." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <Kpi label="Recebido (mês)"   value={formatBRL(f.totaisMes.recebido)}    color="sage" />
        <Kpi label="Pendente"         value={formatBRL(f.totaisMes.pendente)}    color="amber" />
        <Kpi label="Valor médio/sessão" value={formatBRL(f.valorMedioSessao)} />
        <Kpi label="Inadimplência"    value={`${f.inadimplenciaPct.toFixed(0)}%`} color={f.inadimplenciaPct > 20 ? 'rose' : undefined} />
      </div>

      {f.cobrancas.length === 0 ? (
        <EmptyState>Sem cobranças no mês.</EmptyState>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', textAlign: 'left' }}>
                <Th>Sessão</Th><Th>Paciente</Th><Th>Método</Th><Th>Valor</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {f.cobrancas.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>{formatDateTimeBR(c.dataHora)}</Td>
                  <Td>{c.pacienteNome}</Td>
                  <Td>{c.pagamentoMetodo ?? '—'}</Td>
                  <Td>{formatBRL(c.valor)}</Td>
                  <Td>
                    <span className={`badge ${pagamentoColor(c.pagamentoStatus)}`}>
                      {labelPagamento(c.pagamentoStatus)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color?: 'sage' | 'amber' | 'rose' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) { return <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</th> }
function Td({ children }: { children: React.ReactNode }) { return <td style={{ padding: '10px 14px' }}>{children}</td> }

function pagamentoColor(s: string) {
  if (s === 'pago')        return 'sage'
  if (s === 'reembolsado') return 'muted'
  if (s === 'falhou')      return 'rose'
  return 'amber'
}
function labelPagamento(s: string) {
  return ({ pago: 'Pago', pendente: 'Pendente', falhou: 'Falhou', reembolsado: 'Reembolsado' } as Record<string, string>)[s] ?? s
}
