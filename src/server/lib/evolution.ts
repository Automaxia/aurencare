import 'server-only'
import axios from 'axios'
import { env, integrationStatus } from './env'
import { log } from './log'

/**
 * Cliente Evolution API (Baileys). §10.
 * Quando placeholder, registra a mensagem no log e segue (não interrompe fluxos).
 */

function toNumber(telefone: string): string {
  const digits = telefone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function enviarWA(telefone: string, texto: string): Promise<void> {
  const number = toNumber(telefone)
  if (!integrationStatus.evolution) {
    log.warn('evolution', `[mock] → ${telefone}: ${texto.slice(0, 80).replace(/\n/g, ' ')}…`)
    return
  }
  try {
    // Evolution API v2: payload é { number, text } no topo (v1 usava textMessage.text).
    await axios.post(
      `${env.evolutionUrl}/message/sendText/${env.evolutionInstance}`,
      { number, text: texto },
      { headers: { apikey: env.evolutionKey!, 'Content-Type': 'application/json' }, timeout: 12_000 },
    )
    log.ok('evolution', `→ ${telefone} (${texto.length} chars)`)
  } catch (err) {
    log.err('evolution', `falha ao enviar para ${telefone}`, err instanceof Error ? err.message : err)
  }
}

/**
 * Templates de mensagem dos 6 fluxos. §10.
 */
export const WA_TEMPLATES = {
  fluxo1_boasVindas: (nomePaciente: string, link: string, psicologa: string) =>
    `Olá, ${nomePaciente.split(' ')[0]}! Sou da equipe de ${psicologa}.

Para começar, leia e aceite os termos no link:
${link}

Qualquer dúvida, é só responder por aqui.`,

  fluxo2_perguntarMetodo: (dataHora: string, valor: number) =>
    `Sua sessão de ${dataHora} está reservada (R$ ${valor.toFixed(2)}).

Como prefere pagar?
• Responda *PIX* (1x via QR Code)
• Responda *CREDITO* (até 6x no cartão)
• Responda *DEBITO* (à vista no débito)`,

  /**
   * Confirmação informativa de série recorrente (ex: 4 sessões toda sexta 15h).
   * NÃO pede método aqui — cron dispara fluxo2_perguntarMetodo 48h antes
   * de cada sessão. Evita inundar o paciente com 4 perguntas idênticas.
   */
  fluxo2_serieInformativa: (params: { nome: string; datas: string[]; valor: number; gratuita?: boolean }) => {
    const lista = params.datas.map((d, i) => `${i + 1}. ${d}`).join('\n')
    const cabecalho = params.gratuita
      ? `Foram agendadas ${params.datas.length} sessões pra você:`
      : `Foram agendadas ${params.datas.length} sessões pra você (R$ ${params.valor.toFixed(2)} cada):`
    const metodo = params.gratuita
      ? ''
      : `\n\nVou te perguntar o método de pagamento (PIX, crédito ou débito) ~48h antes de cada uma.`
    return `Olá, ${params.nome.split(' ')[0]}!

${cabecalho}

${lista}${metodo}

Qualquer mudança, é só responder por aqui.`
  },

  fluxo2_pix: (qrcodeUrl: string, valor: number) =>
    `Aqui está seu QR Code PIX (R$ ${valor.toFixed(2)}).

${qrcodeUrl}

⏳ Expira em 30 minutos. Após o pagamento, sua sessão será confirmada automaticamente.`,

  fluxo2_checkout: (url: string, metodo: 'credito' | 'debito', valor: number) =>
    `Aqui está o link para pagamento ${metodo === 'credito' ? 'no cartão de crédito (até 6x)' : 'no débito'} de R$ ${valor.toFixed(2)}:

${url}

⏳ Expira em 2 horas.`,

  fluxo2_confirmado: (dataHora: string) =>
    `✅ Pagamento confirmado. Sua sessão de ${dataHora} está confirmada.`,

  fluxo3_lembrete24h: (dataHora: string) =>
    `Lembrete: você tem sessão amanhã, ${dataHora}.

Responda *CONFIRMAR* ou *CANCELAR*.`,

  fluxo3_lembrete2h: (dataHora: string) =>
    `Sua sessão é em 2h (${dataHora}). Até daqui a pouco!`,

  fluxo5_canceladaComReembolso: () =>
    `Sessão cancelada. O reembolso foi solicitado e deve cair em até 5 dias úteis.`,

  fluxo5_canceladaSemReembolso: () =>
    `Sessão cancelada. Como o cancelamento foi feito em menos de 24h da sessão, não há reembolso conforme acordo.`,

  fluxo6_posSessao: (numero: number) =>
    `Obrigada pela sessão de hoje (#${numero}). Cuide-se bem. Até a próxima.`,

  /**
   * Confirmação pós-sessão pelo paciente — proteção contra má-fé.
   * janela = string já formatada ("em até 2 horas" / "até amanhã 9h").
   */
  fluxo7_confirmacao: (params: {
    nomePaciente: string
    horaSessao: string
    psicologa: string
    janela: string
    linkConfirmacao: string
    gratuita?: boolean
  }) =>
    `Olá, ${params.nomePaciente.split(' ')[0]}!

Sua sessão de hoje às ${params.horaSessao} com ${params.psicologa} ocorreu como combinado?

• Responda *SIM* para confirmar
• Responda *NAO* se tiver algo a relatar

Você também pode confirmar pelo link:
${params.linkConfirmacao}

${params.gratuita
  ? `Sem resposta ${params.janela}, consideramos que ocorreu normalmente.`
  : `Sem resposta ${params.janela}, o pagamento é liberado automaticamente.`}`,

  fluxo7_confirmado: () =>
    `Obrigada por confirmar. Bom descanso.`,

  fluxo7_contestado: () =>
    `Recebemos seu retorno. Vamos avaliar e entrar em contato em até 1 dia útil.`,

  fluxoFallback: () =>
    `Recebi sua mensagem. Vou avisar sua psicóloga — em breve te respondem por aqui.`,
}
