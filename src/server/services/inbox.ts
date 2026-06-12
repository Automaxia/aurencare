import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { log } from '@/server/lib/log'
import { gerarCobrancaPix, gerarCobrancaCartao, cancelarSessao, buscarSessao } from './sessoes'
import { criarOuObterSala } from './salaVideo'
import { formatDateTimeBR } from '@/lib/formatters'
import { obterConversa, atualizarConversa, registrarSaida, registrarMensagem, buscarPacientePorTelefone, resolverPsicologo, normalizar } from './wa-conversa'
import { gerarMensagemSegura, type Intent } from './wa-voz'
import { env } from '@/server/lib/env'
import { processarResposta, acharSessaoPendentePorTelefone, type RespostaPaciente } from './confirmacaoSessao'

/**
 * Roteador de mensagens WhatsApp. §10.
 *
 * Decide próxima ação baseada em:
 *  1. Comandos clássicos (PIX, CONFIRMAR…) — fluxo de pagamento (Fluxo 2/4)
 *  2. Estado da conversa (wa_conversas) — onboarding inbound
 *  3. Paciente já cadastrado ou não
 */
type Inbound = { telefone: string; texto: string; instance?: string | null }

export async function processarMensagemRecebida(msg: Inbound): Promise<void> {
  const tel = normalizar(msg.telefone)
  const cmd = (msg.texto ?? '').trim()
  const cmdUpper = cmd.toUpperCase()

  // Persiste a mensagem recebida no histórico (inbox). Resolve psi/paciente pra
  // garantir que apareça na caixa de entrada da psicóloga, inclusive em comandos.
  {
    const psi = await resolverPsicologo(msg.instance).catch(() => null)
    const pac = await buscarPacientePorTelefone(tel).catch(() => null)
    await registrarMensagem(tel, 'in', cmd, { psicologoId: psi?.id ?? null, pacienteId: pac?.id ?? null })
  }

  // ──────────────────────────────────────────────────────────────────
  // 0) Confirmação pós-sessão (Fluxo 7) — SIM/NAO/NÃO
  //    Só consome a mensagem se há sessão pendente. Senão, deixa cair
  //    no fluxo normal (evita interceptar "sim" de outra conversa).
  // ──────────────────────────────────────────────────────────────────
  const respConfirmacao = parseRespostaConfirmacao(cmdUpper)
  if (respConfirmacao) {
    const sessaoId = await acharSessaoPendentePorTelefone(tel)
    if (sessaoId) return processarConfirmacaoPosSessao(tel, sessaoId, respConfirmacao)
    // sem pendência → segue pro fluxo padrão
  }

  // ──────────────────────────────────────────────────────────────────
  // 1) Comandos clássicos do fluxo de pagamento — independem do estado
  //    (paciente já tem sessão aberta esperando método/confirmação).
  //    Aceita a palavra exata ("PIX") OU frases naturais ("quero pagar via
  //    pix", "pode ser no crédito") — ver detectarComandoPagamento.
  // ──────────────────────────────────────────────────────────────────
  const cmdPagamento = detectarComandoPagamento(cmd)
  if (cmdPagamento) {
    const exato = ['PIX', 'CREDITO', 'CRÉDITO', 'DEBITO', 'DÉBITO', 'CONFIRMAR', 'CANCELAR'].includes(cmdUpper)
    // Palavra exata sempre intercepta (compat). Frase natural só intercepta se
    // o remetente já é paciente — evita sequestrar o onboarding de um lead novo
    // que por acaso mencione "pix" na saudação.
    if (exato || (await buscarPacientePorTelefone(tel))) {
      return processarComandoPagamento({ telefone: tel, cmd: cmdPagamento })
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 2) Roteador conversacional baseado em estado
  // ──────────────────────────────────────────────────────────────────
  const conversa = await obterConversa(tel)
  const psicologo = await resolverPsicologo(msg.instance)
  if (!psicologo) {
    log.warn('wa.inbox', 'nenhuma psicóloga configurada — ignorando')
    return
  }

  // Se conversa.psicologoId ainda não setado, seta agora
  if (!conversa.psicologoId) {
    await atualizarConversa(tel, { psicologoId: psicologo.id })
  }

  // Detecta paciente existente (pode já ter sido cadastrado pela psicóloga manualmente)
  const pacienteExistente = await buscarPacientePorTelefone(tel)
  if (pacienteExistente && !conversa.pacienteId) {
    await atualizarConversa(tel, { pacienteId: pacienteExistente.id, estado: 'onboarded' })
    conversa.pacienteId = pacienteExistente.id
    conversa.estado = 'onboarded'
  }

  switch (conversa.estado) {
    case 'inicio':
      return iniciarConversa(tel, psicologo)

    case 'coletando_nome':
      return receberNome(tel, cmd, psicologo)

    case 'coletando_email':
      return receberEmail(tel, cmd, psicologo)

    case 'aguardando_consent':
      return receberConsent(tel, cmdUpper, psicologo)

    case 'onboarded':
    case 'livre':
      return responderPacienteConhecido(tel, cmd, pacienteExistente ?? null, psicologo)

    default:
      // Em estados intermediários de pagamento, se chegar algo não-comando,
      // responde genérico.
      const fallback = await gerarMensagemSegura({ kind: 'nao_entendi', contexto: {} })
      await enviarERegistrar(tel, fallback)
      return
  }
}

// ──────────────────────────────────────────────────────────────────
// Onboarding inbound
// ──────────────────────────────────────────────────────────────────

async function iniciarConversa(tel: string, psicologo: { id: string; nome: string }) {
  const msg = await gerarMensagemSegura({
    kind: 'saudacao_inicial',
    contexto: { psicologoNome: psicologo.nome },
  })
  await enviarERegistrar(tel, msg)
  await atualizarConversa(tel, { estado: 'coletando_nome' })
}

async function receberNome(tel: string, texto: string, psicologo: { id: string; nome: string }) {
  const nome = limparNome(texto)
  if (!nome) {
    const msg = await gerarMensagemSegura({ kind: 'pedir_nome', contexto: { psicologoNome: psicologo.nome } })
    await enviarERegistrar(tel, msg)
    return
  }
  await atualizarConversa(tel, { contexto: { nomeColetado: nome } })
  const ack = await gerarMensagemSegura({ kind: 'recebeu_nome', contexto: { primeiroNome: nome.split(' ')[0] } })
  const ask = await gerarMensagemSegura({ kind: 'pedir_email', contexto: { primeiroNome: nome.split(' ')[0] } })
  await enviarERegistrar(tel, `${ack}\n\n${ask}`)
  await atualizarConversa(tel, { estado: 'coletando_email' })
}

async function receberEmail(tel: string, texto: string, psicologo: { id: string; nome: string }) {
  const conv = await obterConversa(tel)
  const primeiroNome = (conv.contexto.nomeColetado ?? '').split(' ')[0] || 'você'
  const raw = texto.trim()
  let email: string | null = null
  if (!/^pular$/i.test(raw)) {
    const m = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (m) email = m[0].toLowerCase()
    else {
      // Não é "pular" nem email válido — pede de novo brevemente
      const ask = await gerarMensagemSegura({ kind: 'pedir_email', contexto: { primeiroNome } })
      await enviarERegistrar(tel, ask)
      return
    }
  }
  await atualizarConversa(tel, {
    contexto: { emailColetado: email ?? undefined },
    estado: 'aguardando_consent',
  })
  const msg = await gerarMensagemSegura({
    kind: 'pedir_consentimento',
    contexto: { primeiroNome, psicologoNome: psicologo.nome },
  })
  await enviarERegistrar(tel, msg)
}

async function receberConsent(tel: string, cmd: string, psicologo: { id: string; nome: string }) {
  const conv = await obterConversa(tel)
  const primeiroNome = (conv.contexto.nomeColetado ?? '').split(' ')[0] || 'você'
  const SIM = ['SIM', 'S', 'CONCORDO', 'OK', 'ACEITO']
  const NAO = ['NÃO', 'NAO', 'N', 'NEGO', 'RECUSO']

  if (NAO.some(p => cmd === p || cmd.startsWith(p + ' '))) {
    const msg = await gerarMensagemSegura({ kind: 'consent_recusado', contexto: { primeiroNome } })
    await enviarERegistrar(tel, msg)
    await atualizarConversa(tel, { estado: 'inicio' })   // permite recomeço futuro
    return
  }
  if (!SIM.some(p => cmd === p || cmd.startsWith(p + ' '))) {
    const msg = await gerarMensagemSegura({
      kind: 'pedir_consentimento',
      contexto: { primeiroNome, psicologoNome: psicologo.nome },
    })
    await enviarERegistrar(tel, msg)
    return
  }

  // ── CONSENTIMENTO ACEITO → cria paciente no DB ──
  const nome = conv.contexto.nomeColetado || primeiroNome
  const email = conv.contexto.emailColetado ?? null
  const token = randomUUID().replace(/-/g, '').slice(0, 24)

  // Verifica se já existe (pode ter sido cadastrado manualmente em paralelo)
  const existente = await buscarPacientePorTelefone(tel)
  let pacienteId: string
  if (existente) {
    await db.query(
      `UPDATE pacientes
          SET nome = COALESCE($2, nome),
              email = COALESCE($3, email),
              consentimento_aceito = TRUE,
              consentimento_timestamp = NOW(),
              consentimento_token = COALESCE(consentimento_token, $4)
        WHERE id = $1`,
      [existente.id, nome, email, token],
    )
    pacienteId = existente.id
  } else {
    const ins = await db.query<{ id: string }>(
      `INSERT INTO pacientes (psicologo_id, nome, telefone, email,
         consentimento_aceito, consentimento_timestamp, consentimento_token)
       VALUES ($1, $2, $3, $4, TRUE, NOW(), $5)
       RETURNING id`,
      [psicologo.id, nome, tel, email, token],
    )
    pacienteId = ins.rows[0].id
  }

  await db.query(
    `INSERT INTO consentimentos (paciente_id, texto_versao, ip, user_agent)
     VALUES ($1, 'lgpd-2026.05-wa', NULL, 'whatsapp')`,
    [pacienteId],
  )

  await atualizarConversa(tel, { pacienteId, estado: 'onboarded' })

  const msg = await gerarMensagemSegura({
    kind: 'consent_aceito_onboarded',
    contexto: { primeiroNome, psicologoNome: psicologo.nome },
  })
  await enviarERegistrar(tel, msg)
  log.ok('wa.inbox', `paciente cadastrado via WhatsApp: ${nome} (${tel})`)
}

// ── Assistente do paciente (intents básicos por WhatsApp) ───────────────

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
type IntentPaciente = 'link' | 'agendar' | 'pagamento' | 'ajuda' | 'desconhecido'

function detectarIntentPaciente(texto: string): IntentPaciente {
  const t = semAcento(texto).trim()
  // Resposta pelo número do menu
  if (/^1\b/.test(t)) return 'agendar'
  if (/^2\b/.test(t)) return 'link'
  if (/^3\b/.test(t)) return 'pagamento'
  const tt = ` ${t} `
  if (/\b(link|sala|entrar|acesso|video|chamada|reuniao|como entro|onde entro)\b/.test(tt)) return 'link'
  if (/\b(agendar|marcar|remarcar|remarca|reagendar|nova sessao|novo horario|horario|agenda|quero sessao|proxima sessao|disponibilidade)\b/.test(tt)) return 'agendar'
  if (/\b(pagar|pagamento|pix|cobranca|valor|preco|quanto custa|boleto|cartao|fatura|nota fiscal)\b/.test(tt)) return 'pagamento'
  if (/\b(ajuda|duvida|como funciona|menu|opcoes|oi|ola|bom dia|boa tarde|boa noite|obrigad)\b/.test(tt) || texto.includes('?')) return 'ajuda'
  return 'desconhecido'
}

const MENU_AJUDA =
  `Posso te ajudar por aqui 🙂\n\n` +
  `É só responder com o número:\n\n` +
  `*1* — 📅 Agendar (marcar ou remarcar uma sessão)\n` +
  `*2* — 🔗 Link da sua próxima sessão de vídeo\n` +
  `*3* — 💳 Pagamento (pagar ou tirar dúvidas de cobrança)`

async function responderPacienteConhecido(
  tel: string,
  texto: string,
  paciente: { id: string; psicologoId: string; nome: string } | null,
  psicologo: { id: string; nome: string },
) {
  const intent = detectarIntentPaciente(texto)
  log.info('wa.inbox', `paciente ${tel} intent=${intent} · "${texto.slice(0, 60)}"`)

  if (!paciente) { await enviarERegistrar(tel, MENU_AJUDA); return }

  switch (intent) {
    case 'link':       return responderLinkSessao(tel, paciente, psicologo)
    case 'pagamento':  return responderPagamentoFAQ(tel, paciente, psicologo)
    case 'agendar':    return responderAgendar(tel, paciente, psicologo)
    case 'ajuda':
    default:           await enviarERegistrar(tel, MENU_AJUDA); return
  }
}

/** Próxima sessão futura do paciente (não cancelada/concluída). */
async function proximaSessaoPaciente(pacienteId: string): Promise<{ id: string; data_hora: string; modalidade: string; status: string } | null> {
  const { rows } = await db.query<{ id: string; data_hora: string; modalidade: string; status: string }>(
    `SELECT id, data_hora, modalidade, status FROM sessoes
      WHERE paciente_id = $1
        AND data_hora > NOW() - INTERVAL '1 hour'
        AND status NOT IN ('cancelada','no_show','concluida')
      ORDER BY data_hora ASC LIMIT 1`,
    [pacienteId],
  )
  return rows[0] ?? null
}

async function responderLinkSessao(tel: string, paciente: { id: string; nome: string }, psicologo: { nome: string }) {
  const s = await proximaSessaoPaciente(paciente.id)
  if (!s) {
    await enviarERegistrar(tel, `Você não tem nenhuma sessão agendada no momento. Para marcar, é só me escrever *agendar* — eu aviso ${psicologo.nome.split(' ')[0]}.`)
    return
  }
  const dataFmt = formatDateTimeBR(s.data_hora)
  if (s.modalidade !== 'online') {
    await enviarERegistrar(tel, `Sua próxima sessão (${dataFmt}) é *presencial* — não tem sala de vídeo. Qualquer dúvida do endereço, fale com ${psicologo.nome.split(' ')[0]}.`)
    return
  }
  try {
    const sala = await criarOuObterSala(s.id, 4)
    const link = `${env.appUrl.replace(/\/$/, '')}/sala/${sala.token}`
    await enviarERegistrar(tel, `📹 Aqui está o link da sua sessão de ${dataFmt}:\n${link}\n\nVocê também recebe ele automaticamente ~15 minutos antes do horário.`)
  } catch (err) {
    log.err('wa.inbox', 'falha ao gerar sala', err)
    await enviarERegistrar(tel, `Não consegui gerar o link agora. Tente de novo em instantes — e ele também chega ~15 min antes da sessão.`)
  }
}

async function responderPagamentoFAQ(tel: string, paciente: { id: string }, psicologo: { nome: string }) {
  const { rows } = await db.query<{ id: string; data_hora: string; valor: any; status: string }>(
    `SELECT id, data_hora, valor, status FROM sessoes
      WHERE paciente_id = $1 AND status IN ('aguardando_metodo','aguardando_pagamento')
      ORDER BY data_hora ASC LIMIT 1`,
    [paciente.id],
  )
  const pend = rows[0]
  if (pend && pend.status === 'aguardando_metodo') {
    await enviarERegistrar(tel, WA_TEMPLATES.fluxo2_perguntarMetodo(formatDateTimeBR(pend.data_hora), parseFloat(pend.valor ?? 0)))
    return
  }
  if (pend && pend.status === 'aguardando_pagamento') {
    await enviarERegistrar(tel, `Você tem um pagamento em aberto da sessão de ${formatDateTimeBR(pend.data_hora)}. Se o link expirou, responda *PIX*, *CREDITO* ou *DEBITO* que eu gero um novo.`)
    return
  }
  await enviarERegistrar(tel,
    `Sobre pagamento 💳\n\n` +
    `Quando ${psicologo.nome.split(' ')[0]} agenda uma sessão paga, você recebe aqui o pedido — é só responder *PIX*, *CREDITO* ou *DEBITO* e o link chega na hora. A sessão confirma automaticamente após o pagamento.\n\n` +
    `No momento você não tem nenhuma cobrança pendente.`)
}

async function responderAgendar(tel: string, paciente: { id: string; nome: string }, psicologo: { nome: string }) {
  const primeiro = psicologo.nome.split(' ')[0]
  await enviarERegistrar(tel,
    `📅 As sessões são marcadas por ${primeiro}.\n\n` +
    `Me diga o *dia e horário* que você prefere (ex: "terça às 15h") que eu registro o seu pedido para ${primeiro} confirmar com você.`)
  // Registra a intenção pra acompanhamento (futuro: notificação no painel da psicóloga).
  log.ok('wa.inbox', `PEDIDO DE AGENDAMENTO · paciente=${paciente.nome} tel=${tel}`)
}

// ──────────────────────────────────────────────────────────────────
// Comandos clássicos de pagamento (mantém fluxo existente)
// ──────────────────────────────────────────────────────────────────

async function processarComandoPagamento(opts: { telefone: string; cmd: string }) {
  const { telefone, cmd } = opts
  const { rows: pRows } = await db.query<{ id: string }>(
    `SELECT id FROM pacientes WHERE tel_canon(telefone) = tel_canon($1) LIMIT 1`,
    [telefone],
  )
  const paciente = pRows[0]
  if (!paciente) {
    await enviarERegistrar(telefone, 'Não encontrei seu cadastro. Sua psicóloga foi avisada.')
    log.warn('wa.inbox', `${telefone} respondeu ${cmd} mas não é cadastrado`)
    return
  }

  const { rows: sRows } = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM sessoes
      WHERE paciente_id = $1
        AND status IN ('aguardando_metodo','aguardando_pagamento','confirmada')
        AND data_hora >= NOW() - INTERVAL '6 hours'
      ORDER BY data_hora ASC LIMIT 1`,
    [paciente.id],
  )
  const sessao = sRows[0]

  if (['PIX', 'CREDITO', 'CRÉDITO', 'DEBITO', 'DÉBITO'].includes(cmd)) {
    if (!sessao) {
      await enviarERegistrar(telefone, 'Não encontrei uma sessão aguardando pagamento. Sua psicóloga foi avisada.')
      return
    }
    try {
      if (cmd === 'PIX')                                    await gerarCobrancaPix(sessao.id)
      else if (cmd === 'CREDITO' || cmd === 'CRÉDITO')      await gerarCobrancaCartao(sessao.id, 'credito')
      else                                                  await gerarCobrancaCartao(sessao.id, 'debito')
    } catch (err) {
      log.err('wa.inbox', 'falha ao gerar cobrança', err)
      await enviarERegistrar(telefone, 'Tivemos um problema ao gerar a cobrança. Sua psicóloga foi notificada.')
    }
    return
  }

  if (cmd === 'CONFIRMAR' && sessao) {
    const full = await buscarSessao(sessao.id)
    await enviarERegistrar(telefone, `Confirmado. Até ${full ? new Date(full.dataHora).toLocaleString('pt-BR') : 'breve'}.`)
    return
  }

  if (cmd === 'CANCELAR' && sessao) {
    await cancelarSessao(sessao.id)
    return
  }

  await enviarERegistrar(telefone, WA_TEMPLATES.fluxoFallback())
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

async function enviarERegistrar(telefone: string, texto: string) {
  await enviarWA(telefone, texto)
  await registrarSaida(telefone, texto)
  await registrarMensagem(telefone, 'out', texto)
}

function limparNome(input: string): string | null {
  const s = input.trim().replace(/\s+/g, ' ')
  // Mínimo 2 letras, máx 80, sem símbolos estranhos
  if (s.length < 2 || s.length > 80) return null
  if (!/[a-záàâãéêíóôõúüç]/i.test(s)) return null
  // Bloqueia saudações/comandos que claramente não são nome — inclusive de duas
  // palavras ("bom dia", "boa tarde"), que antes viravam nome de paciente.
  const norm = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const NAO_NOME = new Set([
    'oi', 'ola', 'alo', 'hello', 'hi', 'hey', 'eai', 'eae', 'opa', 'salve', 'blz', 'beleza',
    'bom', 'boa', 'bom dia', 'boa tarde', 'boa noite', 'boa madrugada',
    'tudo bem', 'tudo bom', 'oi tudo bem', 'ola tudo bem', 'oi bom dia', 'ola bom dia',
    'test', 'teste', 'email', 'nome', 'sim', 'nao', 'ok', 'pix', 'cancelar', 'confirmar',
    'obrigado', 'obrigada', 'valeu',
  ])
  if (NAO_NOME.has(norm)) return null
  return s.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

/**
 * Detecta o comando de pagamento a partir da mensagem do paciente.
 * Aceita a palavra exata ("PIX") ou frases naturais ("quero pagar via pix",
 * "pode ser no crédito", "vou cancelar"). Retorna o comando canônico (sem
 * acento) ou null se não houver intenção clara.
 *
 * Princípios:
 *  - Métodos (PIX/CREDITO/DEBITO) são não-destrutivos (geram um link/QR que o
 *    paciente pode ignorar) → toleramos frases. Se a mensagem citar mais de um
 *    método, é ambígua → null (não adivinha).
 *  - CANCELAR dispara cancelamento/reembolso → exige verbo claro de cancelar.
 *  - Negação ("não") suprime o disparo automático (evita "não quero pix").
 */
function detectarComandoPagamento(texto: string): 'PIX' | 'CREDITO' | 'DEBITO' | 'CONFIRMAR' | 'CANCELAR' | null {
  const t = ` ${texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `
  if (!t.trim()) return null

  const negado = /\b(nao|jamais|nunca)\b/.test(t)

  const temPix     = /\bpix\b/.test(t)
  const temCredito = /\bcredito\b|\bcredit\b/.test(t)
  const temDebito  = /\bdebito\b|\bdebit\b/.test(t)
  const metodos = [temPix && 'PIX', temCredito && 'CREDITO', temDebito && 'DEBITO']
    .filter(Boolean) as Array<'PIX' | 'CREDITO' | 'DEBITO'>

  // Um único método citado, sem negação → dispara a cobrança.
  if (metodos.length === 1 && !negado) return metodos[0]
  // Mais de um método (ambíguo) → não adivinha.
  if (metodos.length > 1) return null

  // CANCELAR — verbo claro, sem negação ("não quero cancelar").
  if (!negado && /\bcancelar\b|\bcancela\b|\bcancelo\b|\bcancelamento\b/.test(t)) return 'CANCELAR'

  // CONFIRMAR — confirmação do agendamento (Fluxo 3).
  if (!negado && /\bconfirmar\b|\bconfirmo\b|\bconfirma\b|\bconfirmado\b/.test(t)) return 'CONFIRMAR'

  return null
}

/**
 * Reconhece SIM/NAO em variações comuns. Devolve null se não bate.
 */
function parseRespostaConfirmacao(cmdUpper: string): RespostaPaciente | null {
  const t = cmdUpper.trim()
  if (['SIM', 'SIM!', 'OK', 'CONFIRMO'].includes(t)) return 'sim'
  if (['NAO', 'NÃO', 'N', 'CONTESTAR', 'CONTESTO'].includes(t)) return 'contestou'
  return null
}

async function processarConfirmacaoPosSessao(telefone: string, sessaoId: string, resposta: RespostaPaciente) {
  const r = await processarResposta({ sessaoId }, resposta, { canal: 'whatsapp' })
  if (!r.ok) {
    log.warn('wa.inbox', `confirmacao falhou sessao=${sessaoId} razao=${r.razao}`)
    return
  }
  if (r.jaRespondida) return  // silencioso pra evitar duplicar mensagem
  await enviarERegistrar(
    telefone,
    resposta === 'sim' ? WA_TEMPLATES.fluxo7_confirmado() : WA_TEMPLATES.fluxo7_contestado(),
  )
}
