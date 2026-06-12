import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerSaude } from '@/server/services/financeiro'
import { db } from '@/server/db/pool'
import { formatBRL } from '@/lib/formatters'
import { SaudeInsights } from './insights'
import { SessoesTable, type SessaoRow } from './sessoes-table'

export const dynamic = 'force-dynamic'

export default async function SaudePage() {
  const user = await requirePsicologo()
  const s = await lerSaude(user.id)

  // Sessões dos últimos 90 dias pra tabela filtrável
  const { rows: sessoes } = await db.query<any>(
    `SELECT s.id, s.numero, s.data_hora, s.status, s.modalidade, s.duracao_min, s.valor, s.assinada,
            p.nome AS paciente_nome
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1 AND s.data_hora >= NOW() - INTERVAL '90 days'
      ORDER BY s.data_hora DESC`,
    [user.id],
  )
  const tabela: SessaoRow[] = sessoes.map(r => ({
    id: r.id, numero: r.numero, dataHora: r.data_hora,
    pacienteNome: r.paciente_nome, status: r.status, modalidade: r.modalidade,
    duracaoMin: r.duracao_min, valor: parseFloat(r.valor ?? 0), assinada: r.assinada,
  }))

  const pendente = await db.query<{ v: number }>(
    `SELECT COALESCE(SUM(valor), 0)::float AS v FROM sessoes WHERE psicologo_id = $1 AND pagamento_status = 'pendente'`,
    [user.id],
  ).then(r => r.rows[0]?.v ?? 0)

  // Resumo determinístico — "se a Audere fosse consultora de gestão, o que diria da prática hoje?"
  const itens: { ok: boolean; texto: string }[] = []
  itens.push(s.taxaComparecimentoPct >= 80
    ? { ok: true, texto: 'Comparecimento excelente.' }
    : s.taxaComparecimentoPct < 60
      ? { ok: false, texto: 'Comparecimento abaixo do ideal.' }
      : { ok: true, texto: 'Comparecimento dentro do esperado.' })
  if (s.cancelamentos90d === 0 && s.noShows90d === 0) itens.push({ ok: true, texto: 'Nenhuma falta ou cancelamento recente.' })
  else if (s.taxaCancelamentoPct > 25) itens.push({ ok: false, texto: 'Faltas e cancelamentos acima do usual.' })
  if (s.pacientesAtivos > 0 && s.pacientesComRecente30d < s.pacientesAtivos)
    itens.push({ ok: false, texto: `${s.pacientesComRecente30d} de ${s.pacientesAtivos} pacientes ativos teve sessão nos últimos 30 dias.` })
  else if (s.pacientesAtivos > 0)
    itens.push({ ok: true, texto: 'Todos os pacientes ativos tiveram sessão recente.' })
  if (pendente > 0) itens.push({ ok: false, texto: `Existem ${formatBRL(pendente)} aguardando recebimento.` })
  const saudavel = itens.every(i => i.ok)

  return (
    <div>
      <PageHeader
        title="Saúde da Prática"
        subtitle="Como está o seu consultório."
      />

      {/* Bloco 1 — Resumo da saúde da prática (síntese, primeiro elemento) */}
      <section className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 23, lineHeight: 1.15, color: saudavel ? 'var(--sage)' : 'var(--ink)', marginBottom: 14 }}>
          {saudavel ? 'Sua prática está saudável.' : 'Alguns pontos merecem sua atenção.'}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
          {itens.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
              <span style={{ color: it.ok ? 'var(--sage)' : 'var(--amber)', flex: 'none', fontWeight: 600 }}>{it.ok ? '✓' : '⚠'}</span>
              <span>{it.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Bloco 2 — Observações da Audere (protagonismo, logo abaixo do resumo) */}
      <div style={{ marginBottom: 22 }}>
        <SaudeInsights />
      </div>

      {/* Bloco 3 — Indicadores principais (saúde operacional) */}
      <div className="sec-lbl" style={{ marginBottom: 10 }}>Indicadores principais</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        <KpiBig
          label="Comparecimento"
          value={`${s.taxaComparecimentoPct.toFixed(0)}%`}
          color={s.taxaComparecimentoPct >= 80 ? 'sage' : s.taxaComparecimentoPct < 60 ? 'rose' : 'amber'}
          hint={`${s.sessoesConcluidas90d} de ${s.sessoesPassadas90d} sessões (90 dias)`}
        />
        <KpiBig label="Pacientes ativos" value={String(s.pacientesAtivos)} />
        <KpiBig
          label="Retenção recente"
          value={`${s.pacientesComRecente30d} de ${s.pacientesAtivos}`}
          color={s.pacientesAtivos > 0 && s.pacientesComRecente30d < s.pacientesAtivos ? 'amber' : 'sage'}
          hint="pacientes ativos com sessão nos últimos 30 dias"
        />
        <KpiBig
          label="Faltas + cancelamentos"
          value={`${s.taxaCancelamentoPct.toFixed(0)}%`}
          color={s.taxaCancelamentoPct < 15 ? 'sage' : s.taxaCancelamentoPct > 25 ? 'rose' : 'amber'}
          hint={`${s.noShows90d} faltas · ${s.cancelamentos90d} cancelamentos (90d)`}
        />
      </div>

      {/* Bloco 4 — Indicadores secundários (contexto complementar, menor destaque) */}
      <div className="sec-lbl" style={{ marginBottom: 10 }}>Contexto</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Kpi label="Sessões este mês"    value={s.sessoesMes} />
        <Kpi label="Sessões esta semana" value={s.sessoesSemana} />
        <Kpi label="Valor médio por sessão" value={formatBRL(s.ticketMedio)} />
      </div>

      {/* Bloco 5 — Histórico operacional (recolhido, sem dominar a página) */}
      <details className="bloco-recolhivel">
        <summary>
          <span>Últimas sessões</span>
          <span className="resumo">{tabela.length} nos últimos 90 dias</span>
        </summary>
        <div className="bloco-conteudo">
          <SessoesTable sessoes={tabela} />
        </div>
      </details>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string | number; color?: 'sage' | 'amber' | 'rose' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
    </div>
  )
}

function KpiBig({ label, value, color, hint }: { label: string; value: string; color?: 'sage' | 'amber' | 'rose'; hint?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 36, lineHeight: 1, color: color ? `var(--${color})` : 'var(--ink)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}
