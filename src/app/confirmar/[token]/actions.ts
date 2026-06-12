'use server'

import { headers } from 'next/headers'
import { processarResposta, type RespostaPaciente } from '@/server/services/confirmacaoSessao'
import { log } from '@/server/lib/log'

export async function responderConfirmacaoAction(token: string, resposta: RespostaPaciente) {
  try {
    const h = headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
    const ua = h.get('user-agent')

    return await processarResposta(
      { token },
      resposta,
      { canal: 'web', ip, userAgent: ua },
    )
  } catch (err) {
    // Captura a causa real no log do pod (a tela do paciente já trata o erro).
    // razao distinta de 'sessao_invalida' pra não confundir exceção com dado nulo.
    log.err('confirmacao.action', `falha ao registrar resposta token=${token?.slice(0, 8)}…`,
      err instanceof Error ? `${err.message}\n${err.stack}` : err)
    return { ok: false as const, razao: 'erro_interno' as const, detalhe: err instanceof Error ? err.message : String(err) }
  }
}
