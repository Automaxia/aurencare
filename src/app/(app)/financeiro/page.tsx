import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerFinanceiro, type Periodo, type StatusConfirmacao, type StatusNf } from '@/server/services/financeiro'
import { formatBRL, formatDateTimeBR } from '@/lib/formatters'
import { FinanceiroFilters } from './filters'
import { NfCell } from './NfCell'
import { FinanceiroTabs } from './FinanceiroTabs'

export const dynamic = 'force-dynamic'

const PERIODOS_VALIDOS: Periodo[] = ['mes', '30d', '90d', 'ano']
const STATUSES_VALIDOS = ['pago', 'pendente', 'reembolsado', 'falhou', 'contestado']
const METODOS_VALIDOS  = ['pix', 'credito', 'debito']
const NF_VALIDOS       = ['todos', 'pendente', 'emitida', 'dispensada', 'sem_nf']

type SP = { periodo?: string; status?: string; metodo?: string; nf?: string; busca?: string }

export default async function FinanceiroPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePsicologo()
  const periodo = (PERIODOS_VALIDOS.includes((searchParams?.periodo ?? 'mes') as Periodo)
    ? (searchParams?.periodo ?? 'mes') : 'mes') as Periodo
  const status = (searchParams?.status ?? 'todos').toLowerCase()
  const metodo = (searchParams?.metodo ?? 'todos').toLowerCase()
  const nfFiltro = (searchParams?.nf ?? 'todos').toLowerCase()
  const busca  = (searchParams?.busca ?? '').toLowerCase().trim()

  const f = await lerFinanceiro(user.id, new Date().toISOString(), periodo)
  const agora = Date.now()

  // Resumo operacional do período
  const registradas = f.cobrancas.length
  const semCobranca  = f.cobrancas.filter(c => c.pagamentoStatus === 'isento').length
  const cobradas     = registradas - semCobranca
  // Receita prevista pela agenda (sessões futuras não canceladas)
  const receitaPrevista = await db.query<{ v: number }>(
    `SELECT COALESCE(SUM(valor), 0)::float AS v FROM sessoes
      WHERE psicologo_id = $1 AND data_hora > NOW() AND status NOT IN ('cancelada','no_show')`,
    [user.id],
  ).then(r => r.rows[0]?.v ?? 0)

  // Resumo textual (Melhoria 1)
  const resumoFrases: string[] = []
  resumoFrases.push(f.totaisMes.recebido > 0
    ? `Você recebeu ${formatBRL(f.totaisMes.recebido)} neste período.`
    : 'Nenhum valor recebido neste período.')
  if (f.totaisMes.pendente > 0) resumoFrases.push(`Existem ${formatBRL(f.totaisMes.pendente)} pendentes de confirmação.`)

  const filtradas = f.cobrancas.filter(c => {
    if (busca && !c.pacienteNome.toLowerCase().includes(busca)) return false
    if (STATUSES_VALIDOS.includes(status) && c.pagamentoStatus !== status) return false
    if (METODOS_VALIDOS.includes(metodo) && c.pagamentoMetodo !== metodo) return false
    if (NF_VALIDOS.includes(nfFiltro) && nfFiltro !== 'todos') {
      const pago = c.pagamentoStatus === 'pago'
      if (nfFiltro === 'sem_nf') {
        if (!pago || c.nfStatus !== 'pendente') return false
      } else if (c.nfStatus !== nfFiltro) {
        return false
      }
    }
    return true
  })

  const countsStatus: Record<string, number> = { todos: f.cobrancas.length }
  for (const s of STATUSES_VALIDOS) countsStatus[s] = f.cobrancas.filter(c => c.pagamentoStatus === s).length
  const countsMetodo: Record<string, number> = { todos: f.cobrancas.length }
  for (const m of METODOS_VALIDOS) countsMetodo[m] = f.cobrancas.filter(c => c.pagamentoMetodo === m).length

  // KPIs de NF: total sem NF e dos quais já passaram 30d
  const pagasPeriodo = f.cobrancas.filter(c => c.pagamentoStatus === 'pago')
  const semNf = pagasPeriodo.filter(c => c.nfStatus === 'pendente').length
  const semNfAtrasadas = pagasPeriodo.filter(c => {
    if (c.nfStatus !== 'pendente') return false
    const dias = Math.floor((agora - new Date(c.dataHora).getTime()) / 86400000)
    return dias >= 30
  }).length

  return (
    <div>
      <FinanceiroTabs ativo="cobrancas" />
      <PageHeader title="Financeiro" subtitle={subtituloPeriodo(periodo)} />

      {/* Resumo textual do período (Melhoria 1) */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Resumo do período</div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          {resumoFrases.map((frase, i) => <span key={i}>{frase}{i < resumoFrases.length - 1 ? ' ' : ''}</span>)}
        </div>
      </div>

      {/* Linha 1 — visão geral */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Kpi label={`Recebido (${labelPeriodoCurto(periodo)})`} value={formatBRL(f.totaisMes.recebido)} color="sage" />
        <Kpi label="Líquido estimado"     value={formatBRL(f.liquidoEstimado)} hint="Bruto − taxas Pagar.me" />
        <Kpi label="Previsão de recebimento" value={formatBRL(f.aReceber30d)} hint="Próximos 30 dias" />
        <Kpi label="Pendente"             value={formatBRL(f.totaisMes.pendente)} color="amber" />
      </div>

      {semNfAtrasadas > 0 && (
        <a
          href="?nf=sem_nf"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(196,96,122,.07)', border: '1px solid rgba(196,96,122,.22)',
            color: '#823045', fontSize: 12, textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ flex: 1 }}>
            <strong>{semNfAtrasadas}</strong> {semNfAtrasadas === 1 ? 'cobrança paga há mais de 30 dias' : 'cobranças pagas há mais de 30 dias'} sem Nota Fiscal emitida.
          </span>
          <span style={{ fontSize: 11 }}>ver pendentes →</span>
        </a>
      )}

      <FinanceiroFilters
        periodo={periodo}
        status={status}
        metodo={metodo}
        nfFiltro={nfFiltro}
        busca={busca}
        countsStatus={countsStatus}
        countsMetodo={countsMetodo}
        countSemNf={semNf}
      />

      {/* Resumo operacional + receita prevista (Melhorias 5 e 6) */}
      {registradas > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '10px 14px', marginBottom: 14, background: 'var(--surface)', borderRadius: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
          <span><strong>{labelPeriodoCurto(periodo)}:</strong></span>
          <span>{registradas} {registradas === 1 ? 'sessão registrada' : 'sessões registradas'}</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span>{cobradas} {cobradas === 1 ? 'cobrada' : 'cobradas'}</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span>{semCobranca} sem cobrança</span>
          {f.totaisMes.pendente > 0 && (<><span style={{ color: 'var(--faint)' }}>·</span><span style={{ color: 'var(--amber)' }}>{formatBRL(f.totaisMes.pendente)} pendentes</span></>)}
          {receitaPrevista > 0 && (
            <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
              Receita prevista (agenda): <strong style={{ color: 'var(--ink-soft)' }}>{formatBRL(receitaPrevista)}</strong>
            </span>
          )}
        </div>
      )}

      {filtradas.length === 0 ? (
        <EmptyState>
          {f.cobrancas.length === 0
            ? 'Nenhuma cobrança registrada neste período. As sessões realizadas aparecem aqui automaticamente.'
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
                <Th>Sessão</Th><Th>Paciente</Th><Th>Método</Th><Th>Valor</Th>
                <Th>Status</Th><Th>NF</Th><Th>Confirmação</Th><Th>Cai em</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const dias = Math.floor((agora - new Date(c.dataHora).getTime()) / 86400000)
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <Td>{formatDateTimeBR(c.dataHora)}</Td>
                    <Td>{c.pacienteNome}</Td>
                    <Td>{metodoLabel(c.pagamentoMetodo, c.pagamentoParcelas)}</Td>
                    <Td>
                      {formatBRL(c.valor)}
                      {c.taxaEstimada > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--faint)' }}>
                          − {formatBRL(c.taxaEstimada)} taxa
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className={`badge ${pagamentoColor(c.pagamentoStatus)}`}>
                        {labelPagamento(c.pagamentoStatus)}
                      </span>
                    </Td>
                    <Td>
                      <NfCell
                        sessaoId={c.id}
                        pago={c.pagamentoStatus === 'pago'}
                        status={c.nfStatus}
                        numero={c.nfNumero}
                        diasDesdePagamento={dias}
                      />
                    </Td>
                    <Td><ConfirmBadge status={c.confirmacao} /></Td>
                    <Td style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {c.caiEm ? formatDateBR(c.caiEm) : '—'}
                    </Td>
                  </tr>
                )
              })}
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

function Kpi({ label, value, color, hint }: {
  label: string; value: string;
  color?: 'sage' | 'amber' | 'rose' | 'accent'; hint?: string;
}) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function ConfirmBadge({ status }: { status: StatusConfirmacao }) {
  if (!status) return <span style={{ color: 'var(--faint)', fontSize: 12 }}>—</span>
  const map = {
    aguardando: { label: 'Aguardando', color: 'amber' },
    sim:        { label: 'Confirmado', color: 'sage' },
    silencio:   { label: 'Confirmação automática', color: 'muted' },
    contestou:  { label: 'Contestado', color: 'rose' },
  } as const
  const m = map[status]
  return <span className={`badge ${m.color}`}>{m.label}</span>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', fontWeight: 500, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 14px', ...style }}>{children}</td>
}

function pagamentoColor(s: string) {
  if (s === 'pago')        return 'sage'
  if (s === 'reembolsado') return 'muted'
  if (s === 'isento')      return 'muted'
  if (s === 'falhou')      return 'rose'
  if (s === 'contestado')  return 'rose'
  return 'amber'
}
function labelPagamento(s: string) {
  return ({
    pago: 'Pago', pendente: 'Pendente', falhou: 'Falhou',
    reembolsado: 'Reembolsado', contestado: 'Contestado',
    isento: 'Sessão sem cobrança',
  } as Record<string, string>)[s] ?? s
}
function metodoLabel(m: string | null, parcelas: number): string {
  if (m === 'pix') return 'PIX'
  if (m === 'debito') return 'Débito'
  if (m === 'credito') return parcelas > 1 ? `Crédito ${parcelas}x` : 'Crédito'
  return '—'
}
function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
