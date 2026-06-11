import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { resumoCustos } from '@/server/services/custos'
import { obterCockpitProduto } from '@/server/services/admin'
import { usdParaBrl, USD_BRL } from '@/server/lib/precos'

export const dynamic = 'force-dynamic'

// Receita média esperada por assinatura (ARPU de referência). Configurável —
// fica entre Essencial (R$ 69,90) e Pro (R$ 159,90).
const ARPU_BRL = 99

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic (IA)',
  assemblyai: 'AssemblyAI (transcrição)',
}
const FUNC_META: Record<string, { label: string; cor: string }> = {
  transcricao: { label: 'Transcrição', cor: 'var(--sage)' },
  sessao: { label: 'Sessão ao vivo', cor: 'var(--accent)' },
  memoria: { label: 'Memória Clínica', cor: 'var(--accent)' },
  evolucao: { label: 'Evolução Registrada', cor: 'var(--accent)' },
  temas: { label: 'Temas Recorrentes', cor: 'var(--accent)' },
  objetivos: { label: 'Objetivos (copiloto)', cor: 'var(--accent)' },
  saude: { label: 'Saúde da Prática', cor: 'var(--accent)' },
  outros: { label: 'Outros', cor: 'var(--muted)' },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtBrl = (usd: number) => brl(usdParaBrl(usd))

export default async function EconomiaPage() {
  await requireRole('admin')
  const [r, c] = await Promise.all([resumoCustos(), obterCockpitProduto()])

  const custoMes = usdParaBrl(r.mesTotalUsd)
  const custoSessao = r.custoPorSessaoMesUsd != null ? usdParaBrl(r.custoPorSessaoMesUsd) : null
  const custoPsicologo = c.ativosConta > 0 ? custoMes / c.ativosConta : null
  const custoPaciente = c.pacientesAtivos > 0 ? custoMes / c.pacientesAtivos : null
  const receitaProjetada = c.ativosConta * ARPU_BRL
  const participacaoIa = receitaProjetada > 0 ? (custoMes / receitaProjetada) * 100 : 0
  const margemIa = custoPsicologo != null ? (1 - custoPsicologo / ARPU_BRL) * 100 : null

  const totalMes = r.mesTotalUsd
  const semDados = totalMes <= 0

  // Maior consumidora de IA (excluindo transcrição), para os alertas.
  const topIa = r.porFuncionalidadeMes.filter(f => f.func !== 'transcricao' && f.func !== 'outros').sort((a, b) => b.usd - a.usd)[0]
  const topIaPct = topIa && totalMes > 0 ? (topIa.usd / totalMes) * 100 : 0

  // BLOCO 6 — alertas executivos (determinístico)
  const alertas: { ok: boolean; texto: string }[] = []
  if (custoSessao != null) alertas.push(custoSessao < 1
    ? { ok: true, texto: 'Custo médio por sessão abaixo de R$ 1,00.' }
    : { ok: false, texto: `Custo médio por sessão em ${brl(custoSessao)} — acima de R$ 1,00.` })
  if (margemIa != null) alertas.push(margemIa >= 90
    ? { ok: true, texto: `Margem operacional saudável (~${margemIa.toFixed(0)}% por assinatura).` }
    : { ok: false, texto: `Margem operacional em ~${margemIa.toFixed(0)}% — revisar custo por psicólogo.` })
  alertas.push(participacaoIa < 5
    ? { ok: true, texto: `Operação inteligente consome ${participacaoIa.toFixed(1)}% da receita projetada.` }
    : { ok: false, texto: `Operação inteligente já consome ${participacaoIa.toFixed(1)}% da receita projetada.` })
  if (topIa) alertas.push(topIaPct > 40
    ? { ok: false, texto: `${FUNC_META[topIa.func]?.label ?? topIa.func} é a maior consumidora de IA (${topIaPct.toFixed(0)}% do total).` }
    : { ok: true, texto: 'Nenhuma funcionalidade de IA representa risco financeiro.' })

  return (
    <div>
      <PageHeader
        title="Economia da Plataforma"
        subtitle="Custos, consumo de IA e eficiência operacional da Audere."
        actions={<Link href="/admin" className="btn ghost">← Administração</Link>}
      />

      {/* BLOCO 1 — RESUMO EXECUTIVO */}
      <Section title="Resumo executivo">
        <Grid min={150}>
          <Metric label="Custo total (mês)" value={brl(custoMes)} big />
          <Metric label="Sessões processadas" value={r.sessoesMes} />
          <Metric label="Custo médio / sessão" value={custoSessao != null ? brl(custoSessao) : '—'} />
          <Metric label="Psicólogos ativos" value={c.ativosConta} />
          <Metric label="Custo médio / psicólogo" value={custoPsicologo != null ? brl(custoPsicologo) : '—'} />
        </Grid>
      </Section>

      {/* BLOCO 2 — UNIT ECONOMICS */}
      <Section title="Unit economics" hint="sustentabilidade do modelo">
        <Grid min={150}>
          <Metric label="Custo médio / sessão" value={custoSessao != null ? brl(custoSessao) : '—'} />
          <Metric label="Custo médio / paciente" value={custoPaciente != null ? brl(custoPaciente) : '—'} />
          <Metric label="Custo médio / psicólogo" value={custoPsicologo != null ? brl(custoPsicologo) : '—'} />
          <Metric label="Receita esperada / assinatura" value={brl(ARPU_BRL)} hint="referência configurável" />
          <Metric label="Margem IA estimada" value={margemIa != null ? `${margemIa.toFixed(0)}%` : '—'} color="var(--sage)" />
        </Grid>
      </Section>

      {/* BLOCO 3 — EFICIÊNCIA OPERACIONAL */}
      <Section title="Eficiência operacional" hint="custo em contexto de negócio">
        <Grid min={170}>
          <Metric label="Receita projetada" value={brl(receitaProjetada)} hint={`${c.ativosConta} ativos × ${brl(ARPU_BRL)}`} />
          <Metric label="Custo operacional IA" value={brl(custoMes)} />
          <Metric label="Participação da IA na receita" value={`${participacaoIa.toFixed(2)}%`} color={participacaoIa < 5 ? 'var(--sage)' : 'var(--amber)'} />
          <Metric label="Para cada R$ 100 vendidos" value={brl(participacaoIa)} hint="consumidos pela operação inteligente" />
        </Grid>
      </Section>

      {/* BLOCO 4 — CUSTO POR FUNCIONALIDADE */}
      <Section title="Custo por funcionalidade" hint="onde a plataforma gera custo">
        <div className="card" style={{ padding: 18, display: 'grid', gap: 11 }}>
          {semDados ? <Empty /> : r.porFuncionalidadeMes.map(f => {
            const meta = FUNC_META[f.func] ?? { label: f.func, cor: 'var(--muted)' }
            const w = totalMes > 0 ? Math.round((f.usd / totalMes) * 100) : 0
            return (
              <div key={f.func} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 130px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{meta.label}</span>
                <div style={{ height: 9, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, borderRadius: 5, background: meta.cor, opacity: 0.85 }} />
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  <strong style={{ color: 'var(--ink)' }}>{fmtBrl(f.usd)}</strong> · {w}%
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* BLOCO 5 — CUSTOS POR PROVEDOR */}
      <Section title="Custos por provedor" hint="análise de fornecedores">
        <div className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
          {semDados ? <Empty /> : r.porProviderMes.map(pr => {
            const w = totalMes > 0 ? Math.round((pr.usd / totalMes) * 100) : 0
            return (
              <div key={pr.provider} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 130px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  {PROVIDER_LABEL[pr.provider] ?? pr.provider}
                  {pr.estimado && <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 6 }}>estimado</span>}
                </span>
                <div style={{ height: 9, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, borderRadius: 5, background: 'var(--ink-soft)', opacity: 0.5 }} />
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  <strong style={{ color: 'var(--ink)' }}>{fmtBrl(pr.usd)}</strong> · {w}%
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* BLOCO 6 — ALERTAS EXECUTIVOS */}
      <Section title="Alertas executivos">
        <div className="card" style={{ padding: 18 }}>
          {alertas.length === 0 ? <Empty /> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
              {alertas.map((a, i) => (
                <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                  <span style={{ color: a.ok ? 'var(--sage)' : 'var(--amber)', flex: 'none', fontWeight: 600 }}>{a.ok ? '✓' : '⚠'}</span>
                  <span>{a.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* BLOCO 7 — DETALHAMENTO TÉCNICO (última camada) */}
      <details className="bloco-recolhivel">
        <summary>
          <span>Detalhamento técnico</span>
          <span className="resumo">consumo por componente técnico (mês)</span>
        </summary>
        <div className="bloco-conteudo">
          {semDados ? <Empty /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11 }}>
                  <th style={{ padding: '4px 0' }}>Componente técnico</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Chamadas</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Custo</th>
                </tr>
              </thead>
              <tbody>
                {r.porOperacaoMes.map(o => (
                  <tr key={`${o.provider}-${o.operacao}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 0', color: 'var(--ink-soft)' }}>{o.operacao}</td>
                    <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{o.chamadas}</td>
                    <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBrl(o.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--faint)', lineHeight: 1.6, maxWidth: 760 }}>
        Rastreio <strong>a partir de agora</strong>{r.primeiroRegistro ? ` (desde ${new Date(r.primeiroRegistro).toLocaleDateString('pt-BR')})` : ''} —
        o consolidado total fica no console de cada provedor. <strong>Anthropic</strong> é preciso (tokens reais);
        <strong> AssemblyAI</strong> é estimado pela duração da sessão. Receita projetada usa ARPU de referência
        de {brl(ARPU_BRL)} (editável no topo de <code>page.tsx</code>). Câmbio: US$ 1 = R$ {USD_BRL.toFixed(2)} (<code>precos.ts</code>).
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span className="sec-lbl">{title}</span>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>
}

function Metric({ label, value, color, hint, big }: { label: string; value: number | string; color?: string; hint?: string; big?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: big ? 34 : 28, fontWeight: 400, color: color ?? 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Sem custos registrados ainda — aparece conforme o uso.</div>
}
