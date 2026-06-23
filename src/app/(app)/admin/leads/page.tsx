import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { listarListaEspera } from '@/server/services/listaEspera'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  await requireRole('admin')
  const leads = await listarListaEspera()

  return (
    <div>
      <PageHeader
        title="Lista de espera"
        subtitle={`${leads.length} ${leads.length === 1 ? 'inscrito' : 'inscritos'} no acesso antecipado`}
        actions={<Link href="/admin" className="btn ghost">← Administração</Link>}
      />

      {leads.length === 0 ? (
        <div className="card" style={{ padding: 22, color: 'var(--muted)', fontSize: 13 }}>
          Nenhum inscrito ainda. As inscrições da landing aparecem aqui.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                <th style={th}>Quando</th>
                <th style={th}>Nome</th>
                <th style={th}>Email</th>
                <th style={th}>CRP</th>
                <th style={th}>O que quer testar</th>
                <th style={th}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{formatData(l.createdAt)}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{l.nome}</td>
                  <td style={td}>
                    <a href={`mailto:${l.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{l.email}</a>
                  </td>
                  <td style={{ ...td, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{l.crp || '—'}</td>
                  <td style={{ ...td, color: 'var(--ink-soft)', maxWidth: 320 }}>{l.mensagem || '—'}</td>
                  <td style={{ ...td, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{l.origem || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.6, maxWidth: 720 }}>
        Para convidar alguém, responda o email do lead com o link de cadastro{' '}
        <code>https://app.audere.ia.br/cadastro</code>. Cada inscrição também dispara um aviso
        para <strong>contato@automaxia.com.br</strong> (com reply-to do próprio lead).
      </p>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'top', lineHeight: 1.5 }

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}
