'use server'

import { redefinirSenha, type RedefinirResult } from '@/server/services/recuperacaoSenha'

export async function redefinirSenhaAction(token: string, novaSenha: string): Promise<RedefinirResult> {
  return redefinirSenha(token, novaSenha)
}
