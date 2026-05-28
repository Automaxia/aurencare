import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerFinanceiro, type Periodo } from '@/server/services/financeiro'
import { formatBRL, formatDateTimeBR } from '@/lib/formatters'
import { FinanceiroFilters } from './filters'

export const dynamic = 'force-dynamic'

const PERIODOS_VALIDOS: Periodo[] = ['mes', '30d', '90d', 'ano']
const STATUSES_VALIDOS = ['pago', 'pendente', 'reembolsado', 'falhou']
const METODOS_VALIDOS  = ['pix', 'credito', 'debito']

type SP = { periodo?: string; status?: string; metodo?: string; busca?: string }

export default async function FinanceiroPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePsicologo()
  const periodo = (PERIODOS_VALIDOS.includes((searchParams?.periodo ?? 'mes') as Periodo)
    ? (searchParams?.periodo ?? 'mes') : 'mes') as Periodo
  const status = (searchParams?.status ?? 'todos').toLowerCase()
  const metodo = (searchParams?.metodo ?? 'todos').toLowerCase()
  const busca  = (searchParams?.busca ?? '').toLowerCase().trim()

  const f = await lerFinanceiro(user.id, new Date().toISOString(), periodo)

  const filtradas = f.cobrancas.filter(c => {
    if (busca && !c.pacienteNome.toLowerCase().includes(busca)) return false
    if (STATUSES_VALIDOS.includes(status) && c.pagamentoStatus !== status) return false
    if (METODOS_VALIDOS.includes(metodo) && c.pagamentoMetodo !== metodo) return false
    return true
  })

  const countsStatus: Record<string, number> = { todos: f.cobrancas.length }
  for (const s of STATUSES_VALIDOS) countsStatus[s] = f.cobrancas.filter(c => c.pagamentoStatus === s).length
  const countsMetodo: Record<string, number> = { todos: f.cobrancas.length }
  for (const m of METODOS_VALIDOS) countsMetodo[m] = f.cobrancas.filter(c => c.pagamentoMetodo === m).length

  return (
    <div>
      <PageHeader title="Financeiro" subtitle={subtituloPeriodo(periodo)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <Kpi label={`Recebido (${labelPeriodoCurto(periodo)})`} value={formatBRL(f.totaisMes.recebido)}    color="sage" />
        <Kpi label="Pendente"                                    value={formatBRL(f.totaisMes.pendente)}    color="amber" />
        <Kpi label="Valor médio/sessão"                          value={formatBRL(f.valorMedioSessao)} />
        <Kpi label="Inadimplência"                               value={`${f.inadimplenciaPct.toFixed(0)}%`} color={f.inadimplenciaPct > 20 ? 'rose' : undefined} />
      </div>

      <FinanceiroFilters
        periodo={periodo}
        status={status}
        metodo={metodo}
        busca={busca}
        countsStatus={countsStatus}
        countsMetodo={countsMetodo}
      />

      {filtradas.length === 0 ? (
        <EmptyState>
          {f.cobrancas.length === 0
            ? 'Sem cobranças no período.'
            : 'Nenhuma cobrança bate com esses filtros.'}
        </EmptyState>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {filtradas.length} {filtradas.length === 1 ? 'cobrança' : 'cobranças'}
              {filtradas.length !== f.cobrancas.length && ` de ${f.cobrancas.length}`}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total filtrado: {formatBRL(filtradas.reduce((a, c) => a + c.valor, 0))}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', textAlign: 'left' }}>
                <Th>Sessão</Th><Th>Paciente</Th><Th>Método</Th><Th>Valor</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => (
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

function subtituloPeriodo(p: Periodo): string {
  return ({
    mes: 'Cobranças do mês atual.',
    '30d': 'Cobranças dos últimos 30 dias.',
    '90d': 'Cobranças dos últimos 90 dias.',
    ano: 'Cobranças deste ano.',
  } as Record<Periodo, string>)[p]
}
function labelPeriodoCurto(p: Periodo): string {
  return ({ mes: 'mês', '30d': '30d', '90d': '90d', ano: 'ano' } as Record<Periodo, string>)[p]
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
