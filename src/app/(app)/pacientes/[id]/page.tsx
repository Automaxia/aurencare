import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerCondicoesPaciente } from '@/server/services/contexto'
import { formatPhone } from '@/lib/formatters'
import { PatientProfileForm } from './profile-form'
import { ExportarProntuario } from './ExportarProntuario'
import { AcoesPaciente } from './AcoesPaciente'

export const dynamic = 'force-dynamic'

export default async function PacientePerfilPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string; nome: string; telefone: string; email: string | null; psicologo_id: string; consentimento_aceito: boolean; status: string; created_at: string }>(
    'SELECT id, nome, telefone, email, psicologo_id, consentimento_aceito, status, created_at FROM pacientes WHERE id = $1 LIMIT 1',
    [params.id],
  )
  const p = rows[0]
  if (!p) notFound()
  if (p.psicologo_id !== user.id) redirect('/pacientes')

  const [condicoes, sessoesAssinadas, totalSessoes] = await Promise.all([
    lerCondicoesPaciente(params.id),
    db.query<{ id: string; numero: number; data_hora: string; modalidade: string; duracao_min: number }>(
      `SELECT id, numero, data_hora, modalidade, duracao_min
         FROM sessoes
        WHERE paciente_id = $1 AND assinada = TRUE
        ORDER BY data_hora DESC LIMIT 40`,
      [params.id],
    ).then(r => r.rows.map(row => ({
      id: row.id, numero: row.numero,
      dataHora: row.data_hora,
      modalidade: row.modalidade, duracaoMin: row.duracao_min,
    }))),
    db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`,
      [params.id],
    ).then(r => r.rows[0]?.n ?? 0),
  ])

  const arquivado = p.status === 'inativo'

  return (
    <div>
      {arquivado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(122,117,144,.10)', border: '1px solid var(--border)',
          fontSize: 12, color: 'var(--muted)',
        }}>
          <span style={{ fontSize: 14 }}>⊘</span>
          Paciente arquivado. Reative em <strong>⋯ → Reativar</strong> pra voltar a aparecer nas listas.
        </div>
      )}
      <PageHeader
        title={p.nome}
        subtitle={`${formatPhone(p.telefone)}${p.email ? ' · ' + p.email : ''} · ${p.consentimento_aceito ? 'Consentimento aceito' : 'Aguardando consentimento'}${arquivado ? ' · Arquivado' : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link className="btn ghost" href={`/pacientes/${p.id}/objetivos`}>Objetivos</Link>
            <Link className="btn ghost" href={`/pacientes/${p.id}/temas`}>Temas</Link>
            <Link className="btn ghost" href={`/pacientes/${p.id}/evolucao`}>Evolução</Link>
            <ExportarProntuario pacienteId={p.id} sessoesAssinadas={sessoesAssinadas} />
            <AcoesPaciente
              pacienteId={p.id}
              inicial={{
                nome: p.nome,
                telefone: p.telefone,
                email: p.email,
                status: p.status === 'inativo' ? 'inativo' : 'ativo',
              }}
              totalSessoes={totalSessoes}
            />
          </div>
        }
      />

      <PatientProfileForm pacienteId={p.id} initial={condicoes} />
    </div>
  )
}
