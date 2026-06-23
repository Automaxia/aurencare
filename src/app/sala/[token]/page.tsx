import { notFound } from 'next/navigation'
import { Logo } from '@/components/brand/Logo'
import { CfpBadge } from '@/components/brand/CfpBadge'
import { buscarSalaPorToken } from '@/server/services/salaVideo'
import { db } from '@/server/db/pool'
import { SalaPaciente } from './client'

export const dynamic = 'force-dynamic'

export default async function SalaPage({ params }: { params: { token: string } }) {
  const sala = await buscarSalaPorToken(params.token)
  if (!sala) notFound()

  const expirada = sala.encerradaEm || new Date(sala.ativaAte) < new Date()

  // Busca nome da psicóloga + paciente da sessão pra exibir conforto
  const { rows } = await db.query<{ psi_nome: string; pac_nome: string }>(
    `SELECT pi.nome AS psi_nome, p.nome AS pac_nome
       FROM sessoes s
       JOIN psicologos pi ON pi.id = s.psicologo_id
       JOIN pacientes  p  ON p.id  = s.paciente_id
      WHERE s.id = $1 LIMIT 1`,
    [sala.sessaoId],
  )
  const psi = rows[0]?.psi_nome ?? 'quem te atende'
  const pac = rows[0]?.pac_nome ?? ''

  if (expirada) {
    return <SalaExpirada psicologa={psi} />
  }

  return (
    <SalaPaciente
      token={params.token}
      psicologaNome={psi}
      pacienteNome={pac}
      jaAceitou={!!sala.aceiteTermoEm}
    />
  )
}

function SalaExpirada({ psicologa }: { psicologa: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)', padding: 16 }}>
      <div className="card" style={{ maxWidth: 460, textAlign: 'center', padding: 32 }}>
        <Logo size={36} layout="stack" />
        <h2 style={{ marginTop: 24, marginBottom: 8 }}>Sala encerrada</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          Esta sala não está mais ativa. Entre em contato com {psicologa} pra receber um novo link.
        </p>
        <CfpBadge />
      </div>
    </div>
  )
}
