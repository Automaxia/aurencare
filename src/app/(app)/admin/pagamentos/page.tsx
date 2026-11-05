import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { obterPainelPagamentos } from '@/server/services/adminPagamentos'
import { RodarManutencao } from './RodarManutencao'

export const dynamic = 'force-dynamic'

const brl = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const ha = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  return h < 1 ? 'há menos de 1h' : h < 48 ? `há ${h}h` : `há ${Math.floor(h / 24)} dias`
}

const SITUACAO: Record<string, { rotulo: string; tag: string }> = {
  aprovado: { rotulo: 'Aprovada', tag: 't-ok' },
  em_analise: { rotulo: 'Em análise', tag: 't-info' },
  pendente: { rotulo: 'Aguardando documentos', tag: 't-warn' },
  recusado: { rotulo: 'Recusada', tag: 't-alert' },
  sem_situacao: { rotulo: 'Sem situação (Pagar.me)', tag: '' },
}
const GATEWAY: Record<string, string> = { asaas: 'Asaas', pagarme: 'Pagar.me' }
const METODO: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito' }

export default async function AdminPagamentosPage() {
  await requireRole('admin')
  const p = await obterPainelPagamentos()
  const s = p.saldo

  return (
    <div>
      <PageHeader
        title="Operação de pagamentos"
        subtitle="Saldo para estornos, subcontas, cobranças sem split e webhooks com erro."
        actions={
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <RodarManutencao />
            <Link href="/admin" className="btn">← Administração</Link>
          </span>
        }
      />

      {/* ── Saldo da raiz × reserva (D-08) ── */}
      <Section title="Saldo para estornos PIX" hint="conta raiz do Asaas · D-08">
        <div className="card" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16,
          borderLeft: `3px solid ${s.abaixo ? 'var(--rose)' : s.saldoCentavos == null ? 'var(--faint)' : 'var(--sage)'}`,
        }}>
          <Kpi rotulo="Saldo atual" valor={s.saldoCentavos == null ? '—' : brl(s.saldoCentavos)} destaque={s.abaixo ? 'var(--rose)' : undefined} />
          <Kpi rotulo="Reserva exigida" valor={brl(s.reservaCentavos)} />
          <Kpi rotulo="Estornos PIX na fila" valor={brl(s.filaCentavos)} />
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6, alignSelf: 'center' }}>
            {s.erro ? s.erro
              : s.abaixo ? <><strong style={{ color: 'var(--rose)' }}>Saldo abaixo da reserva.</strong> Estornos PIX vão para a fila até entrar saldo — não saque abaixo da reserva.</>
                : 'Saldo cobre a reserva. Estornos PIX saem na hora.'}
          </div>
        </div>
      </Section>

      {/* ── Estornos pendentes ── */}
      <Section title="Estornos pendentes" hint={`${p.estornos.length} na fila · o cron tenta de hora em hora`}>
        {p.estornos.length === 0 ? <Vazio>Nenhum estorno na fila.</Vazio> : (
          <Tabela cab={['Desde', 'Psicóloga', 'Paciente', 'Valor', 'Método', 'Motivo']}>
            {p.estornos.map(e => (
              <tr key={e.sessaoId} style={tr}>
                <td style={td}>{dataHora(e.desde)}<div style={sub}>{ha(e.desde)}</div></td>
                <td style={td}>{e.psicologo}</td>
                <td style={td}>{e.paciente}</td>
                <td style={td}>{reais(e.valor)}</td>
                <td style={td}>{METODO[e.metodo ?? ''] ?? '—'}<div style={sub}>{GATEWAY[e.gateway ?? ''] ?? ''}</div></td>
                <td style={{ ...td, color: 'var(--ink-soft)' }}>{e.motivo ?? '—'}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Subcontas ── */}
      <Section title="Recebedores por situação" hint="KYC no gateway">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {p.subcontas.contagem.length === 0 && <Vazio>Nenhum recebedor cadastrado.</Vazio>}
          {p.subcontas.contagem.map(c => (
            <span key={`${c.gateway}-${c.situacao}`} className={`tag ${SITUACAO[c.situacao]?.tag ?? ''}`} style={{ fontSize: 12 }}>
              {GATEWAY[c.gateway] ?? c.gateway} · {SITUACAO[c.situacao]?.rotulo ?? c.situacao}: <strong style={{ marginLeft: 4 }}>{c.n}</strong>
            </span>
          ))}
        </div>
        {p.subcontas.pendentes.length > 0 && (
          <Tabela cab={['Psicóloga', 'E-mail', 'Situação', 'Cadastro concluído']}>
            {p.subcontas.pendentes.map(r => (
              <tr key={r.psicologoId} style={tr}>
                <td style={td}>{r.nome}</td>
                <td style={{ ...td, color: 'var(--ink-soft)' }}>{r.email}</td>
                <td style={td}><span className={`tag ${SITUACAO[r.situacao]?.tag ?? ''}`}>{SITUACAO[r.situacao]?.rotulo ?? r.situacao}</span></td>
                <td style={td}>{r.concluidoEm ? <>{dataHora(r.concluidoEm)}<div style={sub}>{ha(r.concluidoEm)}</div></> : '—'}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Cobranças sem split ── */}
      <Section title="Cobranças sem split" hint="últimos 60 dias · psicóloga sem recebedor apto (RF-PG-24)">
        {p.semSplit.length === 0 ? <Vazio>Todas as cobranças saíram com split.</Vazio> : (
          <Tabela cab={['Sessão', 'Psicóloga', 'Valor', 'Método', 'Cobrança', 'Status']}>
            {p.semSplit.map(c => (
              <tr key={c.sessaoId} style={tr}>
                <td style={td}>{dataHora(c.quando)}</td>
                <td style={td}>{c.psicologo}</td>
                <td style={td}>{reais(c.valor)}</td>
                <td style={td}>{METODO[c.metodo ?? ''] ?? '—'}</td>
                <td style={{ ...td, fontFamily: 'var(--font-mono), monospace', fontSize: 12 }}>{GATEWAY[c.gateway] ?? c.gateway} · {c.cobranca}</td>
                <td style={td}>{c.status}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Webhooks ── */}
      <Section title="Webhooks com erro" hint="últimos 7 dias · reprocessados pelo cron a cada 10 min">
        {p.webhooks.divergenciaSplit.length > 0 && (
          <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--rose)', fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--rose)' }}>Split bloqueado por divergência</strong> em {p.webhooks.divergenciaSplit.length} cobrança(s) —
            o Asaas dá 2 dias úteis para corrigir no painel:{' '}
            {p.webhooks.divergenciaSplit.map(d => d.cobranca ?? d.eventoId).join(', ')}
          </div>
        )}
        {p.webhooks.comErro.length === 0 ? <Vazio>Nenhum evento com erro.</Vazio> : (
          <Tabela cab={['Recebido', 'Gateway', 'Evento', 'Erro']}>
            {p.webhooks.comErro.map(w => (
              <tr key={`${w.gateway}-${w.eventoId}`} style={tr}>
                <td style={td}>{dataHora(w.recebidoEm)}</td>
                <td style={td}>{GATEWAY[w.gateway] ?? w.gateway}</td>
                <td style={td}>{w.tipo}<div style={{ ...sub, fontFamily: 'var(--font-mono), monospace' }}>{w.eventoId}</div></td>
                <td style={{ ...td, color: 'var(--rose)', fontSize: 12 }}>{w.erro}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'top', lineHeight: 1.5 }
const tr: React.CSSProperties = { borderTop: '1px solid var(--border)' }
const sub: React.CSSProperties = { fontSize: 11, color: 'var(--muted)' }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span className="sec-lbl">{title}</span>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Tabela({ cab, children }: { cab: string[]; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {cab.map(c => <th key={c} style={th}>{c}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{rotulo}</div>
      <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: 28, lineHeight: 1.1, color: destaque ?? 'var(--ink)' }}>{valor}</div>
    </div>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ padding: 18, color: 'var(--muted)', fontSize: 13 }}>{children}</div>
}
