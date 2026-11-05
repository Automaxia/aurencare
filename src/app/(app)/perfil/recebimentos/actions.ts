'use server'

import { requirePsicologo } from '@/server/lib/auth'
import { revalidatePath } from 'next/cache'
import { log } from '@/server/lib/log'
import {
  atualizarChavePix, atualizarSituacaoDoPsicologo, documentosDoPsicologo, enviarDocumentoDoPsicologo,
  type AtualizarChavePixResult, type TipoChavePix, type EnviarDocumentoResult,
} from '@/server/services/onboardingPagamento'
import {
  atualizarPerfilTributario,
  type AtualizarPerfilTributarioInput, type AtualizarPerfilTributarioResult,
} from '@/server/services/perfilTributario'

/** Consulta agora a situação da subconta no Asaas. */
export async function atualizarSituacaoAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  try {
    const s = await atualizarSituacaoDoPsicologo(user.id)
    if (!s) return { ok: false, error: 'Não há conta de recebimento no Asaas para consultar.' }
    revalidatePath('/perfil/recebimentos')
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (err) {
    log.err('perfil.recebimentos', 'falha ao consultar situação no Asaas', err)
    return { ok: false, error: 'Não foi possível consultar o Asaas agora. Tente em alguns minutos.' }
  }
}

/** Documentos pendentes da subconta — lidos na hora do clique (o link expira). */
export async function documentosAction(): Promise<
  { ok: true; dados: NonNullable<Awaited<ReturnType<typeof documentosDoPsicologo>>> } | { ok: false; error: string }
> {
  const user = await requirePsicologo()
  try {
    const dados = await documentosDoPsicologo(user.id)
    if (!dados) return { ok: false, error: 'Não há conta de recebimento no Asaas.' }
    return { ok: true, dados }
  } catch (err) {
    log.err('perfil.recebimentos', 'falha ao listar documentos no Asaas', err)
    return { ok: false, error: 'Não foi possível consultar o Asaas agora. Tente em alguns minutos.' }
  }
}

export async function enviarDocumentoAction(form: FormData): Promise<EnviarDocumentoResult> {
  const user = await requirePsicologo()
  const grupoId = form.get('grupoId')
  const arquivo = form.get('arquivo')
  if (typeof grupoId !== 'string' || !(arquivo instanceof File)) return { ok: false, error: 'Escolha um arquivo.' }
  const r = await enviarDocumentoDoPsicologo(user.id, grupoId, arquivo)
  if (r.ok) { revalidatePath('/perfil/recebimentos'); revalidatePath('/', 'layout') }
  return r
}

export async function atualizarChavePixAction(
  chave: { tipo: TipoChavePix; valor: string } | null,
): Promise<AtualizarChavePixResult> {
  const user = await requirePsicologo()
  return atualizarChavePix(user.id, chave)
}

export async function atualizarPerfilTributarioAction(
  input: AtualizarPerfilTributarioInput,
): Promise<AtualizarPerfilTributarioResult> {
  const user = await requirePsicologo()
  return atualizarPerfilTributario(user.id, input)
}
