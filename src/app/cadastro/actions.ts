'use server'

import { cadastrarPsicologa, type NovaPsicologa, type CadastroResult } from '@/server/services/cadastroPsicologo'

export async function cadastrarAction(input: NovaPsicologa): Promise<CadastroResult> {
  return cadastrarPsicologa(input)
}
