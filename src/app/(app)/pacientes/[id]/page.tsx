import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerCondicoesPaciente } from '@/server/services/contexto'
import { formatPhone } from '@/lib/formatters'
import { PatientProfileForm } from './profile-form'

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

  const condicoes = await lerCondicoesPaciente(params.id)

  return (
    <div>
      <PageHeader
        title={p.nome}
        subtitle={`${formatPhone(p.telefone)}${p.email ? ' · ' + p.email : ''} · ${p.consentimento_aceito ? 'Consentimento aceito' : 'Aguardando consentimento'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn ghost" href={`/pacientes/${p.id}/objetivos`}>Objetivos</Link>
            <Link className="btn ghost" href={`/pacientes/${p.id}/temas`}>Temas</Link>
            <Link className="btn ghost" href={`/pacientes/${p.id}/evolucao`}>Evolução</Link>
          </div>
        }
      />

      <PatientProfileForm pacienteId={p.id} initial={condicoes} />
    </div>
  )
}
