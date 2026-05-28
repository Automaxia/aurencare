import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { obterAtalhos } from '@/server/services/atalhos'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requirePsicologo()
  const data = await obterAtalhos(user.id)
  return NextResponse.json(data)
}
