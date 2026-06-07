import { db } from '@/server/db/pool'
import { Logo } from '@/components/brand/Logo'
import { ConfirmarClient } from './client'

export const dynamic = 'force-dynamic'

type Props = { params: { token: string } }

export default async function ConfirmarPage({ params }: Props) {
  const { rows } = await db.query<{
    id: string; data_hora: string; numero: number;
    paciente_nome: string; psicologa_nome: string;
    confirmacao_resposta: string | null;
    confirmacao_janela_expira_em: string | null;
  }>(
    `SELECT s.id, s.data_hora, s.numero,
            p.nome AS paciente_nome, ps.nome AS psicologa_nome,
            s.confirmacao_resposta, s.confirmacao_janela_expira_em
       FROM sessoes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN psicologos ps ON ps.id = s.psicologo_id
      WHERE s.confirmacao_token = $1 LIMIT 1`,
    [params.token],
  )
  const s = rows[0]

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--page)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <Logo size={28} />
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          {!s ? (
            <Mensagem
              titulo="Link inválido"
              corpo="Esse link de confirmação não foi encontrado. Talvez já tenha sido respondido ou expirado."
            />
          ) : (
            <ConfirmarClient
              token={params.token}
              pacienteNome={s.paciente_nome}
              psicologaNome={s.psicologa_nome}
              dataHora={s.data_hora}
              numero={s.numero}
              respostaAtual={s.confirmacao_resposta}
              janelaExpiraEm={s.confirmacao_janela_expira_em}
            />
          )}
        </div>
      </main>
      <footer style={{ padding: '20px 24px', textAlign: 'center', fontSize: 11, color: 'var(--faint)' }}>
        Audere · sistema operacional da prática clínica
      </footer>
    </div>
  )
}

function Mensagem({ titulo, corpo }: { titulo: string; corpo: string }) {
  return (
    <div className="card" style={{ padding: 28 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, margin: '0 0 8px' }}>
        {titulo}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>{corpo}</p>
    </div>
  )
}
