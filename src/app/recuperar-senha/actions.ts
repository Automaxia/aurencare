'use server'

import { solicitarResetSenha } from '@/server/services/recuperacaoSenha'

export async function solicitarResetAction(email: string): Promise<{ ok: true }> {
  return solicitarResetSenha(email)
}
