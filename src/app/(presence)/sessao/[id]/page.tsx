import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao } from '@/server/services/sessoes'
import { redirect, notFound } from 'next/navigation'
import { PresenceClient } from './client'
import { SessionReview } from './review'

export const dynamic = 'force-dynamic'

const STATUS_REVISAO = new Set(['concluida', 'cancelada', 'no_show'])

export default async function SessaoPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) notFound()
  if (sessao.psicologoId !== user.id) redirect('/')

  // Sessão passada / concluída → modo revisão (read-only + insights).
  if (STATUS_REVISAO.has(sessao.status)) {
    return <SessionReview sessao={sessao} />
  }

  // Sessão futura/em curso → Modo Presença.
  return (
    <PresenceClient
      sessaoId={sessao.id}
      pacienteId={sessao.pacienteId}
      pacienteNome={sessao.pacienteNome}
      numeroSessao={sessao.numero}
      duracaoMin={sessao.duracaoMin}
      pagamentoStatus={sessao.pagamentoStatus}
      status={sessao.status}
    />
  )
}
