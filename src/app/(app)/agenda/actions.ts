'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import {
  reagendarSessao, excluirSessao, cancelarSessaoDoPsicologo, marcarNoShow, interromperSessao,
} from '@/server/services/sessoes'

export async function reagendarSessaoAction(
  sessaoId: string,
  patch: { dataHora?: string; duracaoMin?: number; modalidade?: string },
  escopo: 'uma' | 'seguintes' = 'uma',
): Promise<{ ok: boolean; error?: string; afetadas?: number }> {
  const user = await requirePsicologo()
  if (patch.duracaoMin !== undefined && (isNaN(patch.duracaoMin) || patch.duracaoMin < 10 || patch.duracaoMin > 240)) {
    return { ok: false, error: 'Duração inválida (10–240 min).' }
  }
  if (patch.dataHora !== undefined && isNaN(new Date(patch.dataHora).getTime())) {
    return { ok: false, error: 'Data/hora inválida.' }
  }
  const r = await reagendarSessao(user.id, sessaoId, patch, escopo)
  if (r.ok) { revalidatePath('/agenda'); revalidatePath('/') }
  return { ok: r.ok, afetadas: r.afetadas, error: r.ok ? undefined : 'Não foi possível salvar.' }
}

export async function excluirSessaoAction(
  sessaoId: string,
): Promise<{ ok: boolean; renumeradas?: number; error?: string }> {
  const user = await requirePsicologo()
  const r = await excluirSessao(user.id, sessaoId)
  // Excluir uma concluída vazia também tira o badge "Registrar" do paciente e a
  // sessão da contagem do financeiro — por isso revalida além da agenda. A
  // renumeração muda o "#N" exibido, então o histórico do paciente também entra.
  if (r.ok) {
    revalidarAgenda()
    revalidatePath('/pacientes'); revalidatePath('/pacientes/[id]', 'page')
    revalidatePath('/financeiro')
    return { ok: true, renumeradas: r.renumeradas }
  }
  const msg = {
    nao_encontrada: 'Sessão não encontrada.',
    em_curso: 'A sessão está em curso. Destrave (ou encerre) antes de excluir.',
    registro: 'Esta sessão tem registro clínico (transcrição, nota, resumo ou assinatura) e não pode ser excluída.',
    paga: 'Sessão paga: não dá pra excluir aqui. Cancele/reembolse o paciente antes.',
    cobranca: 'Há uma cobrança ativa nesta sessão. Cancele a cobrança antes de excluir.',
  }[r.motivo]
  return { ok: false, error: msg }
}

/** Revalida as telas que mostram status de sessão. */
function revalidarAgenda() {
  revalidatePath('/agenda'); revalidatePath('/'); revalidatePath('/saude')
}

/**
 * Cancela pelo painel (Fluxo 5: reembolsa se >24h e avisa o paciente). Até aqui
 * o cancelamento só existia pela resposta "CANCELAR" do PACIENTE no WhatsApp —
 * a psicóloga dependia dele pra desmarcar.
 */
export async function cancelarSessaoAction(
  sessaoId: string,
): Promise<{ ok: boolean; reembolsada?: boolean; error?: string }> {
  const user = await requirePsicologo()
  const r = await cancelarSessaoDoPsicologo(user.id, sessaoId)
  if (r.ok) { revalidarAgenda(); return { ok: true, reembolsada: r.reembolsada } }
  const msg = {
    nao_encontrada: 'Sessão não encontrada.',
    realizada: 'Esta sessão já foi realizada e registrada — não dá pra cancelar.',
    em_curso: 'A sessão está em curso. Encerre (ou encerre sem registrar) antes de cancelar.',
    ja_cancelada: 'Esta sessão já está cancelada.',
  }[r.motivo]
  return { ok: false, error: msg }
}

/** Marca/desmarca "sem comparecimento" — anotação de agenda, sem aviso ao paciente. */
export async function marcarNoShowAction(
  sessaoId: string, marcar: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  const r = await marcarNoShow(user.id, sessaoId, marcar)
  if (r.ok) { revalidarAgenda(); return { ok: true } }
  const msg = {
    nao_encontrada: 'Sessão não encontrada.',
    realizada: 'Esta sessão já foi realizada e registrada.',
    em_curso: 'A sessão está em curso. Encerre antes de marcar.',
  }[r.motivo]
  return { ok: false, error: msg }
}

/**
 * Destrava manualmente uma sessão presa em 'em_curso' sem esperar as 6h do cron
 * — a psicóloga vê "● ao vivo" numa sessão que já acabou e resolve na hora.
 */
export async function destravarSessaoAction(
  sessaoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePsicologo()
  const r = await interromperSessao(user.id, sessaoId, 'psicologo')
  if (r.ok) { revalidarAgenda(); return { ok: true } }
  const msg = {
    nao_encontrada: 'Sessão não encontrada.',
    nao_iniciada: 'Esta sessão não está em curso.',
    tem_registro: 'Esta sessão já tem registro clínico. Abra a sessão e encerre normalmente.',
  }[r.motivo]
  return { ok: false, error: msg }
}
