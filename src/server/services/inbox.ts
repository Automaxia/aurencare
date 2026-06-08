import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/server/db/pool'
import { enviarWA, WA_TEMPLATES } from '@/server/lib/evolution'
import { log } from '@/server/lib/log'
import { gerarCobrancaPix, gerarCobrancaCartao, cancelarSessao, buscarSessao } from './sessoes'
import { obterConversa, atualizarConversa, registrarSaida, buscarPacientePorTelefone, resolverPsicologo, normalizar } from './wa-conversa'
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
type Inbound = { telefone: string; texto: string }

export async function processarMensagemRecebida(msg: Inbound): Promise<void> {
  const tel = normalizar(msg.telefone)
  const cmd = (msg.texto ?? '').trim()
  const cmdUpper = cmd.toUpperCase()

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
  const psicologo = await resolverPsicologo()
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
      return responderPacienteConhecido(tel, cmd, pacienteExistente ?? null)

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

async function responderPacienteConhecido(
  tel: string,
  texto: string,
  paciente: { id: string; psicologoId: string; nome: string } | null,
) {
  const primeiroNome = (paciente?.nome ?? '').split(' ')[0] || 'você'
  const msg = await gerarMensagemSegura({
    kind: 'paciente_reconhecido',
    contexto: { primeiroNome },
  })
  await enviarERegistrar(tel, msg)
  // TODO: futura WA.3 — entrar em "escolhendo_horario" se mensagem indicar intenção
  log.info('wa.inbox', `paciente conhecido respondeu: ${tel} · "${texto.slice(0, 60)}"`)
}

// ──────────────────────────────────────────────────────────────────
// Comandos clássicos de pagamento (mantém fluxo existente)
// ──────────────────────────────────────────────────────────────────

async function processarComandoPagamento(opts: { telefone: string; cmd: string }) {
  const { telefone, cmd } = opts
  const { rows: pRows } = await db.query<{ id: string }>(
    `SELECT id FROM pacientes WHERE right(telefone, 11) = right($1, 11) LIMIT 1`,
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
}

function limparNome(input: string): string | null {
  const s = input.trim().replace(/\s+/g, ' ')
  // Mínimo 2 letras, máx 80, sem símbolos estranhos
  if (s.length < 2 || s.length > 80) return null
  if (!/[a-záàâãéêíóôõúüç]/i.test(s)) return null
  // Bloqueia comandos comuns que claramente não são nome
  if (/^(oi|olá|ola|hello|hi|test|teste|email|nome|sim|nao|não|ok|pix|cancelar|confirmar)$/i.test(s)) return null
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
