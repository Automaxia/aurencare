import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerVisaoContabil, type AlertaContabil, type Imposto } from '@/server/services/visaoContabil'
import { REGIME_LABELS } from '@/server/services/perfilTributario'
import { formatBRL } from '@/lib/formatters'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { ExportarContador } from './ExportarContador'

export const dynamic = 'force-dynamic'

export default async function VisaoContabilPage() {
  const user = await requirePsicologo()
  const v = await lerVisaoContabil(user.id)

  return (
    <div>
      <FinanceiroTabs ativo="contabil" />
      <PageHeader
        title="Visão contábil"
        subtitle={`${v.mesAtual.rotulo} · ${v.perfil.regimeTributario ? REGIME_LABELS[v.perfil.regimeTributario] : 'Regime tributário não configurado'}`}
        actions={<ExportarContador />}
      />

      {/* Alertas */}
      {v.alertas.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          {v.alertas.map((a, i) => <AlertaCard key={i} a={a} />)}
        </div>
      )}

      {/* KPIs principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <Kpi
          label="Recebido bruto"
          value={formatBRL(v.mesAtual.recebidoBruto)}
          color="sage"
          delta={v.variacaoBrutoPct}
        />
        <Kpi
          label="Líquido estimado"
          value={formatBRL(v.mesAtual.liquidoEstimado)}
          hint={`− ${formatBRL(v.mesAtual.taxasEstimadas)} taxas`}
        />
        <Kpi
          label="ISS estimado"
          value={formatBRL(v.issEstimado)}
          hint={v.perfil.issAliquotaPct != null
            ? `${v.perfil.issAliquotaPct}% · ${v.perfil.municipio ?? '—'}`
            : 'configure no perfil'}
          color="muted"
        />
        <Kpi
          label={impostoLabel(v.imposto?.tipo)}
          value={v.imposto ? formatBRL(v.imposto.valorEstimado) : '—'}
          hint={v.imposto ? `${v.imposto.aliquotaEfetivaPct.toFixed(2)}% efetiva` : 'sem regime configurado'}
          color={v.imposto ? 'rose' : 'muted'}
        />
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 22,
        background: 'rgba(176,125,64,.06)', border: '1px solid rgba(176,125,64,.20)',
        fontSize: 11, color: '#7a5520', lineHeight: 1.55,
      }}>
        Todos os valores acima são <strong>estimativas pra orientação</strong>.
        O cálculo final de impostos é responsabilidade do(a) contador(a).
        {v.imposto && ` ${v.imposto.observacao}`}
      </div>

      {/* Breakdown por método */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={Section}>Receita por método</h3>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
            <MetodoBlock
              label="PIX"
              valor={v.mesAtual.recebidoPorMetodo.pix}
              total={v.mesAtual.recebidoBruto}
              cor="var(--accent)"
            />
            <MetodoBlock
              label="Crédito"
              valor={v.mesAtual.recebidoPorMetodo.credito}
              total={v.mesAtual.recebidoBruto}
              cor="var(--sage)"
            />
            <MetodoBlock
              label="Débito"
              valor={v.mesAtual.recebidoPorMetodo.debito}
              total={v.mesAtual.recebidoBruto}
              cor="var(--amber)"
            />
          </div>
        </div>
      </section>

      {/* Comparativo mês anterior */}
      {v.mesAnterior && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={Section}>Comparativo</h3>
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  <Th>Indicador</Th>
                  <Th align="right">{v.mesAtual.rotulo}</Th>
                  <Th align="right">{v.mesAnterior.rotulo}</Th>
                  <Th align="right">Variação</Th>
                </tr>
              </thead>
              <tbody>
                <LinhaComp
                  rotulo="Recebido bruto"
                  atual={v.mesAtual.recebidoBruto}
                  ant={v.mesAnterior.recebidoBruto}
                />
                <LinhaComp
                  rotulo="Taxas Pagar.me"
                  atual={v.mesAtual.taxasEstimadas}
                  ant={v.mesAnterior.taxasEstimadas}
                  inverter
                />
                <LinhaComp
                  rotulo="Líquido estimado"
                  atual={v.mesAtual.liquidoEstimado}
                  ant={v.mesAnterior.liquidoEstimado}
                />
                <LinhaComp
                  rotulo="Sessões pagas"
                  atual={v.mesAtual.cobrancasCount}
                  ant={v.mesAnterior.cobrancasCount}
                  formatador={n => `${n}`}
                />
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Resumo de NF */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={Section}>Notas fiscais do mês</h3>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          <NfStat label="Emitidas" valor={v.mesAtual.cobrancasNfEmitida} cor="var(--sage)" />
          <NfStat label="Pendentes" valor={v.mesAtual.cobrancasNfPendente} cor={v.mesAtual.cobrancasNfPendente > 0 ? 'var(--rose)' : 'var(--muted)'} />
          <NfStat label="Dispensadas" valor={v.mesAtual.cobrancasNfDispensada} cor="var(--muted)" />
        </div>
        {v.mesAtual.cobrancasNfPendente > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            Resolva as pendentes em <Link href="/financeiro?nf=sem_nf" style={{ color: 'var(--accent)' }}>Cobranças → Sem NF</Link>.
          </p>
        )}
      </section>

      {/* Resumo regime + acumulado */}
      <section style={{ marginBottom: 22 }}>
        <h3 style={Section}>Tributário e acumulado</h3>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <DetalheLinha rotulo="Regime tributário" valor={v.perfil.regimeTributario ? REGIME_LABELS[v.perfil.regimeTributario] : 'Não configurado'} />
          <DetalheLinha rotulo="CNAE" valor={v.perfil.cnae} />
          <DetalheLinha rotulo="Município ISS" valor={v.perfil.municipio ? `${v.perfil.municipio} / ${v.perfil.municipioUf ?? '—'} · ${v.perfil.issAliquotaPct ?? '—'}%` : 'Não configurado'} />
          <DetalheLinha rotulo="Receita bruta acumulada (12m)" valor={formatBRL(v.receitaBruta12m)} destaque />
          {(v.perfil.regimeTributario === 'pj_simples_anexo3' || v.perfil.regimeTributario === 'pj_simples_anexo5') && (
            <DetalheLinha
              rotulo="Teto Simples Nacional"
              valor={`R$ 4.800.000,00 — ${((v.receitaBruta12m / 4800000) * 100).toFixed(1)}% utilizado`}
            />
          )}
          {v.perfil.nomeContador && (
            <DetalheLinha rotulo="Contador" valor={`${v.perfil.nomeContador}${v.perfil.emailContador ? ' · ' + v.perfil.emailContador : ''}`} />
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Componentes auxiliares ─────────────────────────────────────────

const Section: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400,
  color: 'var(--ink-soft)', marginBottom: 10, marginTop: 0,
}

function Kpi({ label, value, color, hint, delta }: {
  label: string; value: string;
  color?: 'sage' | 'amber' | 'rose' | 'muted' | 'accent';
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 24,
        color: color ? `var(--${color})` : 'var(--ink)',
      }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
        {hint && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
        {delta != null && delta !== 0 && (
          <span style={{
            fontSize: 11,
            color: delta > 0 ? 'var(--sage)' : 'var(--rose)',
            marginLeft: 'auto',
          }}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  )
}

function AlertaCard({ a }: { a: AlertaContabil }) {
  const cores = ({
    info:     { bg: 'rgba(106,78,200,.06)', border: 'rgba(106,78,200,.22)', ico: 'var(--accent)' },
    atencao:  { bg: 'rgba(176,125,64,.07)', border: 'rgba(176,125,64,.22)', ico: 'var(--amber)' },
    critico:  { bg: 'rgba(196,96,122,.07)', border: 'rgba(196,96,122,.25)', ico: 'var(--rose)' },
  } as const)[a.nivel]
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '12px 14px', borderRadius: 8,
      background: cores.bg, border: `1px solid ${cores.border}`,
    }}>
      <span style={{ fontSize: 14, color: cores.ico, marginTop: 1 }}>
        {a.nivel === 'critico' ? '⚠' : a.nivel === 'atencao' ? '!' : 'i'}
      </span>
      <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.titulo}</div>
        <div style={{ color: 'var(--muted)' }}>{a.detalhe}</div>
      </div>
    </div>
  )
}

function MetodoBlock({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cor, marginRight: 6 }} />
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>{formatBRL(valor)}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{pct}% do total</div>
      <div style={{ height: 4, borderRadius: 999, background: 'var(--surface)', marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, opacity: .7 }} />
      </div>
    </div>
  )
}

function LinhaComp({ rotulo, atual, ant, inverter, formatador }: {
  rotulo: string;
  atual: number;
  ant: number;
  inverter?: boolean;  // pra "Taxas" (subir = pior)
  formatador?: (n: number) => string;
}) {
  const fmt = formatador ?? formatBRL
  const variacao = ant > 0 ? ((atual / ant) - 1) * 100 : null
  const subiu = variacao != null && variacao > 0
  const corVar = variacao == null ? 'var(--muted)'
    : Math.abs(variacao) < 1 ? 'var(--muted)'
    : (inverter ? !subiu : subiu) ? 'var(--sage)' : 'var(--rose)'
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 14px' }}>{rotulo}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono), monospace' }}>{fmt(atual)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono), monospace', color: 'var(--muted)' }}>{fmt(ant)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: corVar }}>
        {variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${variacao.toFixed(0)}%`}
      </td>
    </tr>
  )
}

function NfStat({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: cor }}>{valor}</div>
    </div>
  )
}

function DetalheLinha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rotulo}</span>
      <span style={{
        fontSize: destaque ? 16 : 13,
        fontWeight: destaque ? 500 : 400,
        color: destaque ? 'var(--ink)' : 'var(--ink-soft)',
        textAlign: 'right',
      }}>{valor}</span>
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '10px 14px', fontWeight: 500, fontSize: 11,
      color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em',
      textAlign: align ?? 'left',
    }}>{children}</th>
  )
}

function impostoLabel(tipo?: Imposto['tipo']): string {
  if (tipo === 'irpf_mensal')         return 'Carnê-Leão (estim.)'
  if (tipo === 'das_simples_anexo3')  return 'DAS Anexo III (estim.)'
  if (tipo === 'das_simples_anexo5')  return 'DAS Anexo V (estim.)'
  if (tipo === 'das_lucro_presumido') return 'Lucro Presumido (estim.)'
  return 'Imposto estimado'
}
