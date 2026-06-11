import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { obterCockpitProduto, listarUsuariosAdmin } from '@/server/services/admin'
import { resumoCustos } from '@/server/services/custos'
import { usdParaBrl } from '@/server/lib/precos'
import { precoCentavos } from '@/server/lib/planos'
import { AdminCockpit } from './AdminCockpit'

export const dynamic = 'force-dynamic'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)

export default async function AdminPage() {
  const admin = await requireRole('admin')
  const [p, usuarios, custos] = await Promise.all([
    obterCockpitProduto(),
    listarUsuariosAdmin(),
    resumoCustos(),
  ])

  const conversaoPct = pct(p.pagantes, p.usuarios)
  const ativacaoPct = pct(p.ativados, p.usuarios)
  const naoAtivados = Math.max(0, p.usuarios - p.ativados)

  // Economia da IA (mês corrente) — em BRL, mesmo câmbio do painel de custos.
  const custoMesBrl = usdParaBrl(custos.mesTotalUsd)
  const custoSessaoBrl = custos.custoPorSessaoMesUsd != null ? usdParaBrl(custos.custoPorSessaoMesUsd) : null
  const custoPsicologoBrl = p.ativosConta > 0 ? custoMesBrl / p.ativosConta : null
  const custoAtivadoBrl = p.ativados > 0 ? custoMesBrl / p.ativados : null

  // Receita — MRR estimado pelo preço mensal de cada plano pago ativo.
  const mrrBrl = (p.pagEssencial * precoCentavos('essencial', 'mensal') + p.pagPro * precoCentavos('pro', 'mensal')) / 100
  const receitaPorPagante = p.pagantes > 0 ? mrrBrl / p.pagantes : 0

  const funil = [
    { label: 'Cadastrados', n: p.usuarios },
    { label: 'Criaram pacientes', n: p.comPacientes },
    { label: 'Realizaram sessão', n: p.comSessao },
    { label: 'Assinaram evolução', n: p.comEvolucao },
    { label: 'Criaram objetivos', n: p.comObjetivos },
    { label: 'Usaram memória clínica', n: p.comMemoria },
  ]

  return (
    <div>
      <PageHeader
        title="Administração"
        subtitle="Cockpit de produto — o Audere está gerando valor?"
        actions={
          <span style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/leads" className="btn ghost">Lista de espera →</Link>
            <Link href="/admin/custos" className="btn ghost">Economia da plataforma →</Link>
          </span>
        }
      />

      {/* BLOCO 1 — CRESCIMENTO */}
      <Section title="Crescimento">
        <Grid min={130}>
          <Metric label="Usuários totais" value={p.usuarios} />
          <Metric label="Novos (30 dias)" value={p.novos30} hint="cadastros recentes" />
          <Metric label="Contas ativas" value={p.ativosConta} color="var(--sage)" />
          <Metric label="Pagantes" value={p.pagantes} color="var(--accent)" />
          <Metric label="Conversão" value={`${conversaoPct}%`} hint="pagantes ÷ totais" />
        </Grid>
      </Section>

      {/* BLOCO 2 — ADOÇÃO (funil de uso real) */}
      <Section title="Adoção do produto" hint="psicólogos que chegaram a cada etapa">
        <div className="card" style={{ padding: 18, display: 'grid', gap: 11 }}>
          {funil.map((f, i) => {
            const w = pct(f.n, p.usuarios)
            return (
              <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 84px', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{f.label}</span>
                <div style={{ height: 9, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, borderRadius: 5, background: i === 0 ? 'var(--muted)' : 'var(--accent)', opacity: i === 0 ? 0.45 : 0.85, transition: 'width .3s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: 'var(--ink)', fontSize: 14 }}>{f.n}</strong> · {w}%
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* BLOCO 3 — ATIVAÇÃO */}
      <Section title="Funil de ativação">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: 18, background: ativacaoPct >= 40 ? 'var(--sage-lo)' : undefined }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Taxa de ativação</div>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 42, lineHeight: 1, marginTop: 4, color: ativacaoPct >= 40 ? 'var(--sage)' : ativacaoPct < 20 ? 'var(--amber)' : 'var(--ink)' }}>{ativacaoPct}%</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
              Ativado = criou paciente <span style={{ color: 'var(--faint)' }}>+</span> realizou sessão <span style={{ color: 'var(--faint)' }}>+</span> assinou evolução
            </div>
          </div>
          <Metric label="Usuários ativados" value={p.ativados} color="var(--sage)" />
          <Metric label="Não ativados" value={naoAtivados} color={naoAtivados > 0 ? 'var(--amber)' : undefined} hint="gargalo de onboarding" />
        </div>
      </Section>

      {/* BLOCO 4 — SAÚDE DO PRODUTO (uso real das funcionalidades) */}
      <Section title="Saúde do produto" hint="uso acumulado das funcionalidades">
        <Grid min={150}>
          <Metric label="Sessões registradas" value={p.sessoesRegistradas} />
          <Metric label="Evoluções assinadas" value={p.evolucoesAssinadas} />
          <Metric label="Objetivos criados" value={p.objetivosCriados} />
          <Metric label="Temas identificados" value={p.temasIdentificados} />
          <Metric label="Consultas à memória clínica" value={p.consultasMemoria} />
          <Metric label="Sessões com IA" value={p.sessoesComIA} color="var(--accent)" />
        </Grid>
      </Section>

      {/* BLOCO 5 — ECONOMIA DA IA (unit economics) */}
      <Section title="Economia da IA" hint="mês corrente" right={<Link href="/admin/custos" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Detalhes →</Link>}>
        <Grid min={150}>
          <Metric label="Custo total (mês)" value={brl(custoMesBrl)} />
          <Metric label="Custo por sessão" value={custoSessaoBrl != null ? brl(custoSessaoBrl) : '—'} hint={`${custos.sessoesMes} sessões c/ IA no mês`} />
          <Metric label="Custo por psicólogo ativo" value={custoPsicologoBrl != null ? brl(custoPsicologoBrl) : '—'} />
          <Metric label="Custo por usuário ativado" value={custoAtivadoBrl != null ? brl(custoAtivadoBrl) : '—'} />
          <Metric label="Tokens consumidos (mês)" value={p.tokensMes.toLocaleString('pt-BR')} hint="entrada + saída · Anthropic" />
        </Grid>
      </Section>

      {/* BLOCO 6 — RECEITA */}
      <Section title="Receita">
        <Grid min={150}>
          <Metric label="MRR estimado" value={brl(mrrBrl)} color="var(--accent)" hint="preço mensal dos planos ativos" />
          <Metric label="Receita por pagante" value={p.pagantes > 0 ? brl(receitaPorPagante) : '—'} />
          <Metric label="Valor médio / sessão paga" value={p.valorMedioSessaoPaga > 0 ? brl(p.valorMedioSessaoPaga) : '—'} hint="transacionado na plataforma" />
          <Metric label="Pagantes" value={p.pagantes} hint={`${p.pagEssencial} Essencial · ${p.pagPro} Pro`} />
        </Grid>
      </Section>

      {/* BLOCO 7 — OPERAÇÃO (tabela deixa de ser protagonista) */}
      <details className="bloco-recolhivel">
        <summary>
          <span>Operação · usuários</span>
          <span className="resumo">{usuarios.length} cadastrados · gerenciar papel, status e plano</span>
        </summary>
        <div className="bloco-conteudo">
          <AdminCockpit usuarios={usuarios} adminId={admin.id} />
        </div>
      </details>
    </div>
  )
}

function Section({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="sec-lbl">{title}</span>
          {hint && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>
}

function Metric({ label, value, color, hint }: { label: string; value: number | string; color?: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 30, fontWeight: 400, color: color ?? 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}
