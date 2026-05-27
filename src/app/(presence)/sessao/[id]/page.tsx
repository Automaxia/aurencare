import { requirePsicologo } from '@/server/lib/auth'
import { buscarSessao } from '@/server/services/sessoes'
import { redirect, notFound } from 'next/navigation'
import { PresenceClient } from './client'

export const dynamic = 'force-dynamic'

export default async function SessaoPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const sessao = await buscarSessao(params.id)
  if (!sessao) notFound()
  if (sessao.psicologoId !== user.id) redirect('/')

  return (
    <PresenceClient
      sessaoId={sessao.id}
      pacienteNome={sessao.pacienteNome}
      numeroSessao={sessao.numero}
      duracaoMin={sessao.duracaoMin}
      pagamentoStatus={sessao.pagamentoStatus}
    />
  )
}
