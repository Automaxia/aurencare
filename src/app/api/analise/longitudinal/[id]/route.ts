import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'

/**
 * Dados agregados para Evolução Registrada — frequência de temas por sessão,
 * intervalos médios, indicadores.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows: pacientes } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [params.id, user.id])
  if (pacientes.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { rows: sessoes } = await db.query<{ id: string; numero: number; data_hora: string; resumo_ia: string | null; indicadores: any }>(
    `SELECT id, numero, data_hora, resumo_ia, indicadores
       FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE
       ORDER BY data_hora ASC`,
    [params.id],
  )

  const intervalos: number[] = []
  for (let i = 1; i < sessoes.length; i++) {
    intervalos.push((+new Date(sessoes[i].data_hora) - +new Date(sessoes[i-1].data_hora)) / 86_400_000)
  }
  const intervaloMedio = intervalos.length
    ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length
    : null

  return NextResponse.json({
    total: sessoes.length,
    intervaloMedioDias: intervaloMedio,
    sessoes: sessoes.map(s => ({
      id: s.id, numero: s.numero, dataHora: s.data_hora,
      resumo: tryDecrypt(s.resumo_ia),
      indicadores: s.indicadores,
    })),
  })
}
