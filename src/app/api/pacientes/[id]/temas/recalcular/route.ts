import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { iniciarRecalculoBackground, statusRecalculo } from '@/server/services/temas'
import { db } from '@/server/db/pool'

async function ehDono(pacienteId: string, psicologoId: string): Promise<boolean> {
  const { rows } = await db.query(
    'SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2',
    [pacienteId, psicologoId],
  )
  return rows.length > 0
}

// Dispara o recálculo em segundo plano e retorna NA HORA (sem esperar a IA) —
// evita o 504 do nginx em pacientes com muitas sessões. O cliente faz polling no GET.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  if (!(await ehDono(params.id, user.id))) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Por padrão o recálculo é INCREMENTAL: sessão já extraída com o mesmo prompt e a
  // mesma conceitualização é reaproveitada (0 chamadas de IA). `?forcar=1` reextrai
  // tudo — escape hatch pra quando o prompt muda sem bump da string de versão.
  const forcar = new URL(req.url).searchParams.get('forcar') === '1'
  const r = iniciarRecalculoBackground(params.id, 'clinico', { forcar })
  return NextResponse.json({ ok: true, processing: true, jaRodando: r.jaRodando, forcar }, { status: 202 })
}

// Status do recálculo em background (polling do cliente).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  if (!(await ehDono(params.id, user.id))) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(statusRecalculo(params.id))
}
