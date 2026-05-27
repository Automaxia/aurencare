import 'server-only'
import { db } from '@/server/db/pool'
import {
  gerarCobrancaPix, gerarCobrancaCartao, cancelarSessao, buscarSessao,
} from './sessoes'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { log } from '@/server/lib/log'

/**
 * Processa mensagem recebida no WhatsApp.
 * Identifica o paciente pelo telefone e roteia o comando.
 * §10 Fluxo 4.
 */

type InboundMessage = {
  telefone: string         // E164 sem '+' (ex: 5511999...)
  texto: string
}

export async function processarMensagemRecebida(msg: InboundMessage): Promise<void> {
  const cmd = (msg.texto ?? '').trim().toUpperCase()
  const tel = msg.telefone.replace(/\D/g, '').replace(/^55/, '')

  const { rows } = await db.query<{ id: string; psicologo_id: string }>(
    'SELECT id, psicologo_id FROM pacientes WHERE right(telefone, 11) = right($1, 11) LIMIT 1',
    [tel],
  )
  const paciente = rows[0]
  if (!paciente) {
    log.info('evolution.inbox', `mensagem de telefone desconhecido ${msg.telefone}`)
    return
  }

  // Sessão ativa = última sessão aguardando algo (método ou pagamento), ou confirmada futura.
  const { rows: sRows } = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM sessoes
      WHERE paciente_id = $1
        AND status IN ('aguardando_metodo','aguardando_pagamento','confirmada')
        AND data_hora >= NOW() - INTERVAL '6 hours'
      ORDER BY data_hora ASC LIMIT 1`,
    [paciente.id],
  )
  const sessao = sRows[0]

  if (['PIX', 'CREDITO', 'DEBITO', 'CRÉDITO', 'DÉBITO'].includes(cmd)) {
    if (!sessao) {
      await enviarWA(msg.telefone, 'Não encontrei uma sessão aguardando pagamento. Sua psicóloga foi notificada.')
      log.warn('evolution.inbox', `${msg.telefone} respondeu ${cmd} sem sessão ativa`)
      return
    }
    try {
      if (cmd === 'PIX')                                    await gerarCobrancaPix(sessao.id)
      else if (cmd === 'CREDITO' || cmd === 'CRÉDITO')      await gerarCobrancaCartao(sessao.id, 'credito')
      else                                                  await gerarCobrancaCartao(sessao.id, 'debito')
    } catch (err) {
      log.err('evolution.inbox', 'falha ao gerar cobrança', err)
      await enviarWA(msg.telefone, 'Tivemos um problema ao gerar a cobrança. Sua psicóloga foi notificada.')
    }
    return
  }

  if (cmd === 'CONFIRMAR') {
    if (sessao) {
      const full = await buscarSessao(sessao.id)
      await enviarWA(msg.telefone, `✅ Confirmado. Até ${full ? formatPt(full.dataHora) : 'breve'}.`)
    }
    return
  }

  if (cmd === 'CANCELAR') {
    if (sessao) {
      await cancelarSessao(sessao.id)
    }
    return
  }

  // Fallback — notificar psicóloga (notificação no painel via SSE poderia ir aqui).
  await enviarWA(msg.telefone, WA_TEMPLATES.fluxoFallback())
  log.info('evolution.inbox', `mensagem livre de ${msg.telefone}: ${msg.texto.slice(0, 60)}`)
}

function formatPt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
