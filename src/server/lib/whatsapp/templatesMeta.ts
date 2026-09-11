/**
 * Templates da Cloud API (Meta) — espelho das mensagens de `WA_TEMPLATES` que
 * INICIAM conversa com o paciente.
 *
 * Por que existe: na Cloud API a empresa só manda texto livre dentro da
 * "janela de atendimento" (24h após a ÚLTIMA mensagem do paciente). Fora dela
 * a Meta recusa (erro 131047) e só aceita template aprovado. Lembrete, cobrança,
 * boas-vindas e pós-sessão quase sempre caem fora da janela — então cada um
 * precisa de um template.
 *
 * Regras da Meta que moldam o desenho:
 *  - parâmetro ({{n}}) NÃO pode ter quebra de linha, tab nem 4+ espaços
 *    seguidos → `param()` normaliza;
 *  - corpo não deve começar nem terminar com parâmetro → todos terminam com
 *    frase fixa;
 *  - categoria UTILITY (transacional): grátis dentro da janela, ~R$ 0,04 fora.
 *
 * O texto aqui é o que vai pra aprovação — mudou o texto, muda o NOME (ou
 * cria versão), porque template aprovado é imutável. `sincronizarTemplatesMeta`
 * cria os que faltam na WABA; não edita os existentes.
 *
 * Sem `'server-only'` de propósito: o catálogo é dado puro e a página admin
 * (server component) e o cliente Graph importam daqui.
 */

export type TemplateMeta = { name: string; params: string[] }

export type DefinicaoTemplate = {
  /** Corpo com {{1}}, {{2}}… — pode ter quebras de linha e *negrito*. */
  body: string
  /** Um exemplo por parâmetro — a Meta exige pra revisar. */
  exemplo: string[]
  /** Botões de resposta rápida (máx. 3). O texto do botão volta no webhook
   *  como `button.text` e cai no mesmo parser de comandos (PIX, SIM…). */
  botoes?: string[]
}

export const IDIOMA_TEMPLATES = 'pt_BR'
export const CATEGORIA_TEMPLATES = 'UTILITY'

/** Normaliza um valor pra caber em parâmetro de template. */
export function param(v: string | number): string {
  return String(v)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}

const primeiro = (nome: string) => param(nome.split(' ')[0] || nome)
const brl = (valor: number) => valor.toFixed(2)

export const CATALOGO_META: Record<string, DefinicaoTemplate> = {
  audere_boas_vindas: {
    body: `Olá, {{1}}! Sou da equipe de {{2}}.

Para começar, leia e aceite os termos no link:
{{3}}

Qualquer dúvida, é só responder por aqui.`,
    exemplo: ['Maria', 'Dra. Ana Souza', 'https://app.audere.ia.br/onboard/abc123'],
  },

  audere_sessao_metodo: {
    body: `Sua sessão de {{1}} está reservada (R$ {{2}}).

Como prefere pagar?
• Responda *PIX* (1x via QR Code)
• Responda *CREDITO* (até 6x no cartão)
• Responda *DEBITO* (à vista no débito)`,
    exemplo: ['sexta, 12/09 às 15:00', '150.00'],
    botoes: ['PIX', 'CREDITO', 'DEBITO'],
  },

  audere_sessao_agendada: {
    body: `Sua sessão de {{1}} está agendada e confirmada. ✅

{{2}}

Qualquer mudança, é só responder por aqui.`,
    exemplo: ['sexta, 12/09 às 15:00', 'Não é necessário pagamento.'],
  },

  audere_sessao_remarcada: {
    body: `📅 Sua sessão foi remarcada para {{1}}.

Qualquer dúvida, é só responder por aqui.`,
    exemplo: ['sexta, 19/09 às 15:00'],
  },

  audere_serie_remarcada: {
    body: `📅 Suas próximas {{1}} sessões foram remarcadas para {{2}}.

Qualquer dúvida, é só responder por aqui.`,
    exemplo: ['4', 'sexta-feira às 15:00, a partir de 19/09/2026'],
  },

  audere_serie_agendada: {
    body: `Olá, {{1}}!

Foram agendadas {{2}} sessões pra você: {{3}}

{{4}}

Qualquer mudança, é só responder por aqui.`,
    exemplo: ['Maria', '4', '1. sexta, 12/09 às 15:00 · 2. sexta, 19/09 às 15:00', 'Vou te perguntar o método de pagamento (PIX, crédito ou débito) ~48h antes de cada uma.'],
  },

  audere_pix: {
    body: `Aqui está seu QR Code PIX (R$ {{1}}):
{{2}}

⏳ Expira em 30 minutos. Após o pagamento, sua sessão será confirmada automaticamente.`,
    exemplo: ['150.00', 'https://api.pagar.me/core/v5/qrcode?payload=abc'],
  },

  audere_checkout: {
    body: `Aqui está o link para pagamento {{1}} de R$ {{2}}:
{{3}}

⏳ Expira em 2 horas.`,
    exemplo: ['no cartão de crédito (até 6x)', '150.00', 'https://payment-link.pagar.me/pl_abc123'],
  },

  audere_pagamento_confirmado: {
    body: `✅ Pagamento confirmado. Sua sessão de {{1}} está confirmada.

{{2}}

Qualquer dúvida, é só responder por aqui.`,
    exemplo: ['sexta, 12/09 às 15:00', 'Até lá!'],
  },

  audere_lembrete_24h: {
    body: `Lembrete: você tem sessão amanhã, {{1}}.

Responda *CONFIRMAR* ou *CANCELAR*.`,
    exemplo: ['sexta, 12/09 às 15:00'],
    botoes: ['CONFIRMAR', 'CANCELAR'],
  },

  audere_lembrete_2h: {
    body: `Sua sessão é em 2h ({{1}}). Até daqui a pouco!`,
    exemplo: ['sexta, 12/09 às 15:00'],
  },

  audere_lembrete_15min: {
    body: `⏰ Sua sessão começa em ~15 minutos ({{1}}).

{{2}}

Até já!`,
    exemplo: ['sexta, 12/09 às 15:00', '📹 Entre pela sala de vídeo: https://app.audere.ia.br/sala/abc123'],
  },

  audere_link_sala: {
    body: `📹 Sua sessão vai começar. Entre pela sala de vídeo:
{{1}}

É só abrir o link no navegador — não precisa instalar nada.`,
    exemplo: ['https://app.audere.ia.br/sala/abc123'],
  },

  audere_sessao_cancelada: {
    body: `Sessão cancelada. {{1}}

Qualquer dúvida, é só responder por aqui.`,
    exemplo: ['O reembolso foi solicitado e deve cair em até 5 dias úteis.'],
  },

  audere_pos_sessao: {
    body: `Obrigada pela sessão de hoje (#{{1}}). Cuide-se bem. Até a próxima.`,
    exemplo: ['7'],
  },

  audere_confirmacao_sessao: {
    body: `Olá, {{1}}!

Sua sessão de hoje às {{2}} com {{3}} ocorreu como combinado?

• Responda *SIM* para confirmar
• Responda *NAO* se tiver algo a relatar

Você também pode confirmar pelo link:
{{4}}

{{5}}

Obrigada!`,
    exemplo: ['Maria', '15:00', 'Dra. Ana Souza', 'https://app.audere.ia.br/confirmar/abc123', 'Sem resposta em até 2 horas, o pagamento é liberado automaticamente.'],
    botoes: ['SIM', 'NAO'],
  },

  /**
   * Genérico: psicóloga respondendo pelo painel (Conversas) ou boas-vindas com
   * texto personalizado, quando a janela de 24h já fechou. É o único jeito de
   * entregar texto livre fora da janela — e o texto vai como parâmetro, então
   * perde as quebras de linha.
   */
  audere_mensagem_psicologo: {
    body: `Mensagem de {{1}} pela Audere:

{{2}}

Você pode responder por aqui.`,
    exemplo: ['Dra. Ana Souza', 'Oi, Maria! Conseguimos manter o horário de sexta? Me avisa.'],
  },
}

const t = (name: keyof typeof CATALOGO_META, params: (string | number)[]): TemplateMeta =>
  ({ name, params: params.map(param) })

/**
 * Construtores — mesma assinatura das entradas correspondentes de
 * `WA_TEMPLATES`, pra que o chamador passe os dois lado a lado:
 *   enviarWA(tel, WA_TEMPLATES.x(...), { template: WA_META.x(...) })
 */
export const WA_META = {
  fluxo1_boasVindas: (nomePaciente: string, link: string, psicologa: string) =>
    t('audere_boas_vindas', [primeiro(nomePaciente), psicologa, link]),

  /** Boas-vindas com texto personalizado pela psicóloga: vai no genérico. */
  fluxo1_boasVindasCustom: (psicologa: string, texto: string) =>
    t('audere_mensagem_psicologo', [psicologa, texto]),

  fluxo2_perguntarMetodo: (dataHora: string, valor: number) =>
    t('audere_sessao_metodo', [dataHora, brl(valor)]),

  fluxo2_agendadaSemCobranca: (dataHora: string, online?: boolean) =>
    t('audere_sessao_agendada', [dataHora, 'Não é necessário pagamento.' + (online ? ' 📹 Você vai receber o link da sala de vídeo aqui no WhatsApp ~15 minutos antes do horário.' : '')]),

  fluxo2_agendadaPagamentoDireto: (dataHora: string, valor: number, online?: boolean) =>
    t('audere_sessao_agendada', [dataHora, `💳 O pagamento (R$ ${brl(valor)}) será combinado diretamente com seu psicólogo(a).` + (online ? ' 📹 Você vai receber o link da sala de vídeo aqui no WhatsApp ~15 minutos antes do horário.' : '')]),

  fluxo2_remarcada: (dataHora: string) =>
    t('audere_sessao_remarcada', [dataHora]),

  fluxo2_remarcadaSerie: (count: number, slot: string) =>
    t('audere_serie_remarcada', [count, slot]),

  fluxo2_serieInformativa: (params: { nome: string; datas: string[]; valor: number; gratuita?: boolean; pagamentoDireto?: boolean }) => {
    const lista = params.datas.map((d, i) => `${i + 1}. ${d}`).join(' · ')
    const metodo = params.gratuita
      ? 'Sessões sem cobrança.'
      : params.pagamentoDireto
        ? `💳 R$ ${brl(params.valor)} cada — o pagamento será combinado diretamente com seu psicólogo(a).`
        : `R$ ${brl(params.valor)} cada. Vou te perguntar o método de pagamento (PIX, crédito ou débito) ~48h antes de cada uma.`
    return t('audere_serie_agendada', [primeiro(params.nome), params.datas.length, lista, metodo])
  },

  fluxo2_pix: (qrcodeUrl: string, valor: number) =>
    t('audere_pix', [brl(valor), qrcodeUrl]),

  fluxo2_checkout: (url: string, metodo: 'credito' | 'debito', valor: number) =>
    t('audere_checkout', [metodo === 'credito' ? 'no cartão de crédito (até 6x)' : 'no débito', brl(valor), url]),

  fluxo2_confirmado: (dataHora: string, online?: boolean) =>
    t('audere_pagamento_confirmado', [dataHora, online ? '📹 Você vai receber o link da sala de vídeo aqui no WhatsApp ~15 minutos antes do horário.' : 'Até lá!']),

  fluxo3_lembrete24h: (dataHora: string) =>
    t('audere_lembrete_24h', [dataHora]),

  fluxo3_lembrete2h: (dataHora: string) =>
    t('audere_lembrete_2h', [dataHora]),

  fluxo3_lembrete15min: (dataHora: string, linkSala?: string | null) =>
    t('audere_lembrete_15min', [dataHora, linkSala ? `📹 Entre pela sala de vídeo: ${linkSala}` : 'Boa sessão!']),

  linkSalaAgora: (linkSala: string) =>
    t('audere_link_sala', [linkSala]),

  fluxo5_canceladaComReembolso: () =>
    t('audere_sessao_cancelada', ['O reembolso foi solicitado e deve cair em até 5 dias úteis.']),

  fluxo5_canceladaSemReembolso: () =>
    t('audere_sessao_cancelada', ['Como o cancelamento foi feito em menos de 24h da sessão, não há reembolso conforme acordo.']),

  fluxo6_posSessao: (numero: number) =>
    t('audere_pos_sessao', [numero]),

  fluxo7_confirmacao: (params: { nomePaciente: string; horaSessao: string; psicologa: string; janela: string; linkConfirmacao: string; gratuita?: boolean }) =>
    t('audere_confirmacao_sessao', [
      primeiro(params.nomePaciente), params.horaSessao, params.psicologa, params.linkConfirmacao,
      params.gratuita
        ? `Sem resposta ${params.janela}, consideramos que ocorreu normalmente.`
        : `Sem resposta ${params.janela}, o pagamento é liberado automaticamente.`,
    ]),

  mensagemPsicologo: (psicologa: string, texto: string) =>
    t('audere_mensagem_psicologo', [psicologa, texto]),
}
