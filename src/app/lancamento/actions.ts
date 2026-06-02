'use server'

import { headers } from 'next/headers'
import { entrarListaEspera, type EntrarListaInput, type EntrarListaResult } from '@/server/services/listaEspera'

export async function entrarListaEsperaAction(input: Omit<EntrarListaInput, 'ip' | 'userAgent'>): Promise<EntrarListaResult> {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const userAgent = h.get('user-agent') ?? null
  return entrarListaEspera({ ...input, ip, userAgent })
}
