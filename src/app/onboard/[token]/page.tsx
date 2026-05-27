import { db } from '@/server/db/pool'
import { Logo } from '@/components/brand/Logo'
import { OnboardForm } from './form'

export const dynamic = 'force-dynamic'

async function lookupPaciente(token: string) {
  const { rows } = await db.query<{
    id: string; nome: string; consentimento_aceito: boolean
  }>(
    'SELECT id, nome, consentimento_aceito FROM pacientes WHERE consentimento_token = $1 LIMIT 1',
    [token],
  )
  return rows[0] ?? null
}

export default async function OnboardPage({ params }: { params: { token: string } }) {
  const paciente = await lookupPaciente(params.token)

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
      background: 'linear-gradient(180deg, var(--page) 0%, var(--surface) 100%)',
    }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <Logo size={40} layout="stack" tagline />
        </div>

        {!paciente ? (
          <>
            <h2 style={{ textAlign: 'center' }}>Link inválido ou expirado</h2>
            <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
              Solicite à sua psicóloga um novo link de cadastro.
            </p>
          </>
        ) : paciente.consentimento_aceito ? (
          <>
            <h2 style={{ textAlign: 'center' }}>Tudo certo, {paciente.nome.split(' ')[0]}.</h2>
            <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
              Seu cadastro já está aceito. Pode fechar esta página.
            </p>
          </>
        ) : (
          <OnboardForm token={params.token} nome={paciente.nome} />
        )}
      </div>
    </div>
  )
}
