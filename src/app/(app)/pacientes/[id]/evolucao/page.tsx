import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { formatDateBR } from '@/lib/formatters'
import { EvolucaoChat } from './chat'

export const dynamic = 'force-dynamic'

export default async function EvolucaoPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query<{ id: string; nome: string; psicologo_id: string }>(
    'SELECT id, nome, psicologo_id FROM pacientes WHERE id = $1 LIMIT 1', [params.id],
  )
  const paciente = pacientes[0]
  if (!paciente) notFound()
  if (paciente.psicologo_id !== user.id) redirect('/pacientes')

  const { rows: sessoes } = await db.query<{ id: string; numero: number; data_hora: string; resumo_ia: string | null; assinada: boolean; assinatura_timestamp: string | null }>(
    `SELECT id, numero, data_hora, resumo_ia, assinada, assinatura_timestamp
       FROM sessoes
      WHERE paciente_id = $1 AND assinada = TRUE
      ORDER BY data_hora DESC`,
    [params.id],
  )

  return (
    <div>
      <PageHeader title="Evolução Registrada" subtitle={`Continuidade clínica · ${paciente.nome}`} withCfp />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div>
          {sessoes.length === 0 ? (
            <div className="empty">Sem sessões assinadas. Os resumos aparecem aqui após você assinar a sessão no Pós-sessão.</div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
              {sessoes.map(s => (
                <li key={s.id}>
                  <Link href={`/sessao/${s.id}`} className="card" style={{ display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h3 style={{ margin: 0 }}>Sessão #{s.numero}</h3>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateBR(s.data_hora)} →</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                      {tryDecrypt(s.resumo_ia) ?? '(sem resumo)'}
                    </p>
                    {s.assinatura_timestamp && (
                      <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 6 }}>
                        ✓ Assinada em {new Date(s.assinatura_timestamp).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <EvolucaoChat pacienteId={params.id} pacienteNome={paciente.nome} />
      </div>
    </div>
  )
}
