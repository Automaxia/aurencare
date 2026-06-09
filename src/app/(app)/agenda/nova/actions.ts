'use server'

import { revalidatePath } from 'next/cache'
import { requirePsicologo } from '@/server/lib/auth'
import { criarSessao, criarSerie, detectarConflitosSerie, type FrequenciaSerie } from '@/server/services/sessoes'

type Result = { ok: true; sessaoId: string } | { ok: false; error: string }

export async function criarSessaoAction(input: {
  pacienteId: string; dataHora: string; duracaoMin: number; modalidade: string; valor: number
}): Promise<Result> {
  const user = await requirePsicologo()
  if (!input.pacienteId) return { ok: false, error: 'Selecione um paciente.' }
  if (input.valor < 0)   return { ok: false, error: 'Valor inválido.' }
  if (new Date(input.dataHora).getTime() < Date.now()) return { ok: false, error: 'Data/hora no passado.' }

  try {
    const s = await criarSessao({ psicologoId: user.id, ...input })
    revalidatePath('/agenda')
    revalidatePath('/')
    return { ok: true, sessaoId: s.id }
  } catch (err) {
    return { ok: false, error: 'Não foi possível agendar agora.' }
  }
}

type SerieResult = { ok: true; serieId: string; quantidade: number } | { ok: false; error: string }

export async function criarSerieAction(input: {
  pacienteId: string
  primeiraSessaoIso: string
  frequencia: FrequenciaSerie
  quantidade: number
  duracaoMin: number
  modalidade: string
  valor: number
}): Promise<SerieResult> {
  const user = await requirePsicologo()
  if (!input.pacienteId) return { ok: false, error: 'Selecione um paciente.' }
  if (input.valor < 0)   return { ok: false, error: 'Valor inválido.' }
  if (input.quantidade < 2) return { ok: false, error: 'Série precisa de pelo menos 2 sessões.' }
  if (input.quantidade > 52) return { ok: false, error: 'Máximo 52 sessões por série.' }
  if (new Date(input.primeiraSessaoIso).getTime() < Date.now()) return { ok: false, error: 'A primeira sessão está no passado.' }
  if (input.frequencia !== 'semanal' && input.frequencia !== 'quinzenal') {
    return { ok: false, error: 'Frequência inválida.' }
  }

  try {
    const r = await criarSerie({ psicologoId: user.id, ...input })
    revalidatePath('/agenda')
    revalidatePath('/')
    return { ok: true, serieId: r.serieId, quantidade: r.sessoesIds.length }
  } catch (err) {
    return { ok: false, error: 'Não foi possível agendar a série agora.' }
  }
}

/** Devolve apenas o array de ISOs que têm conflito (pra UI). */
export async function conflitosSerieAction(datas: string[]): Promise<string[]> {
  const user = await requirePsicologo()
  const conflitos = await detectarConflitosSerie(user.id, datas)
  return Array.from(conflitos)
}
