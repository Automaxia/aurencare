'use server'

import { headers } from 'next/headers'
import { processarResposta, type RespostaPaciente } from '@/server/services/confirmacaoSessao'

export async function responderConfirmacaoAction(token: string, resposta: RespostaPaciente) {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
  const ua = h.get('user-agent')

  return processarResposta(
    { token },
    resposta,
    { canal: 'web', ip, userAgent: ua },
  )
}
