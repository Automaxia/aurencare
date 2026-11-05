'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/lib/auth'
import { log } from '@/server/lib/log'
import { manutencaoPagamentos } from '@/server/services/manutencaoPagamentos'

/** Roda agora a mesma rotina do cron: estornos, PIX vencidos, webhooks com erro, subcontas. */
export async function rodarManutencaoAction(): Promise<{ ok: boolean; resumo?: string; error?: string }> {
  await requireRole('admin')
  try {
    const r = await manutencaoPagamentos()
    revalidatePath('/admin/pagamentos')
    return {
      ok: true,
      resumo: `Estornos: ${r.estornos.estornados} feitos, ${r.estornos.pendentes} na fila · `
        + `PIX vencidos cancelados: ${r.pix.cancelados} · Webhooks reprocessados: ${r.webhooks.reprocessados} · `
        + `Subcontas: ${r.subcontas.verificadas} verificadas, ${r.subcontas.mudaram} mudaram`,
    }
  } catch (err) {
    log.err('admin.pagamentos', 'falha na manutenção manual', err)
    return { ok: false, error: 'A manutenção falhou — veja os logs do servidor.' }
  }
}
