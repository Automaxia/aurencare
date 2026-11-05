import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { log } from '@/server/lib/log'
import { gatewayPadrao, gatewayDe, type Gateway } from '@/server/lib/pagamentos'
import { PLANOS, capSessoesIa, precoCentavos, type Plano, type PlanoPago, type Ciclo } from '@/server/lib/planos'
import { calcularTroca, type TrocaPlano } from '@/server/lib/trocaPlano'
import { contarSessoesIaMes } from './uso'

export type PlanoStatus = 'ativo' | 'inadimplente' | 'cancelado'

export type AssinaturaInfo = {
  /** Plano EFETIVO — já considera cortesia vencida (ver `obterAssinatura`). */
  plano: Plano
  status: PlanoStatus
  ciclo: Ciclo | null
  expiraEm: string | null
  subscriptionId: string | null
  cap: number
  usadas: number
  restantes: number
  /**
   * Fim da cortesia (plano concedido sem assinatura), enquanto ela vale.
   * `null` para assinante pagante, para free puro e depois de vencida.
   */
  cortesiaAte: string | null
  /** Gateway da assinatura (null = sem assinatura). Muda o texto de "pagamento pendente". */
  gateway: 'pagarme' | 'asaas' | null
  /** Troca agendada para a renovação (descer de plano / trocar ciclo). `em` = AAAA-MM-DD. */
  agendado: { plano: PlanoPago; ciclo: Ciclo; em: string | null } | null
}

/** Estado atual do plano + consumo do mês. Fonte única pro gate, UI e webhook. */
export async function obterAssinatura(psicologoId: string): Promise<AssinaturaInfo> {
  const { rows } = await db.query(
    `SELECT plano, plano_status, plano_ciclo, plano_expira_em, role,
            plano_agendado, plano_ciclo_agendado, to_char(plano_agendado_vigencia, 'YYYY-MM-DD') AS plano_agendado_vigencia,
            COALESCE(assinatura_id, pagarme_subscription_id) AS assinatura_id,
            COALESCE(assinatura_gateway, CASE WHEN pagarme_subscription_id IS NOT NULL THEN 'pagarme' END) AS assinatura_gateway
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0] ?? {}
  const planoGravado = (r.plano ?? 'free') as Plano
  const subscriptionId = r.assinatura_id ?? null
  const expiraEm = r.plano_expira_em ?? null

  const status = (r.plano_status ?? 'ativo') as PlanoStatus

  /*
   * Cortesia = plano acima do free SEM assinatura na Pagar.me (migration 047).
   * Quem pagou sempre tem subscription_id — inclusive no modo mock.
   */
  const ehCortesia = planoGravado !== 'free' && !subscriptionId

  /*
   * Quem atravessa `plano_expira_em` sem perder o plano é APENAS o assinante
   * que ainda vai renovar: subscription ativa na Pagar.me. Nesse caso uma data
   * velha significa webhook atrasado, e rebaixar seria tirar acesso de quem
   * está pagando — quem manda é o webhook.
   *
   * Todo o resto vence na data:
   *   • cortesia do beta (sem subscription);
   *   • assinatura CANCELADA — mantém o acesso até o fim do ciclo já pago e
   *     cai depois. Sem isso o cancelamento nunca surtia efeito: não há nova
   *     cobrança, logo não chega webhook, logo ninguém rebaixava;
   *   • INADIMPLENTE — a cobrança falhou e o acesso ia "até expirar".
   *
   * Exige data preenchida: sem `plano_expira_em` não há o que vencer, e chutar
   * rebaixaria alguém por falta de dado.
   */
  const renovavel = !!subscriptionId && status === 'ativo'
  const venceu =
    planoGravado !== 'free' &&
    !renovavel &&
    expiraEm != null &&
    new Date(expiraEm).getTime() <= Date.now()

  // Efetivo, não gravado: o rebaixamento vale na hora da leitura, sem escrever
  // no banco durante um GET. Se a linha continuar dizendo 'essencial' depois de
  // vencer, o gate e a UI já tratam como free do mesmo jeito.
  // Conta admin (equipe) é sempre Pro, sem vencimento — vale também pra quem
  // for promovido depois, sem depender do que está gravado na linha.
  const ehAdmin = r.role === 'admin'
  const plano: Plano = ehAdmin ? 'pro' : venceu ? 'free' : planoGravado
  const cap = capSessoesIa(plano)
  const usadas = await contarSessoesIaMes(psicologoId)
  return {
    plano,
    status,
    ciclo: r.plano_ciclo ?? null,
    expiraEm,
    subscriptionId,
    cap,
    usadas,
    restantes: Math.max(0, cap - usadas),
    cortesiaAte: ehCortesia && !venceu && !ehAdmin ? expiraEm : null,
    gateway: subscriptionId ? (r.assinatura_gateway === 'asaas' ? 'asaas' : 'pagarme') : null,
    agendado: r.plano_agendado && status === 'ativo' && !venceu
      ? { plano: r.plano_agendado, ciclo: r.plano_ciclo_agendado ?? r.plano_ciclo ?? 'mensal', em: r.plano_agendado_vigencia ?? null }
      : null,
  }
}

export type AssinarResult =
  /** `urlPagamento`: Asaas — o psicólogo paga a 1ª fatura lá; o plano ativa no webhook. */
  | { ok: true; plano: PlanoPago; urlPagamento?: string | null; troca?: TrocaPlano }
  | { ok: false; error: string }

/**
 * Contrata um plano pago: cria a assinatura recorrente na Pagar.me (cartão
 * tokenizado no front) e persiste o plano. O `expiraEm` é provisório (+1 ciclo);
 * o webhook `subscription.charged` reconcilia a data real a cada renovação.
 */
export async function assinar(
  psicologoId: string, plano: PlanoPago, ciclo: Ciclo, cardToken?: string | null,
): Promise<AssinarResult> {
  const { rows } = await db.query(
    `SELECT nome, email, telefone, pgm_documento, cpf, plano, plano_ciclo, plano_status, plano_expira_em,
            COALESCE(assinatura_id, pagarme_subscription_id) AS assinatura_id,
            COALESCE(assinatura_gateway, CASE WHEN pagarme_subscription_id IS NOT NULL THEN 'pagarme' END) AS assinatura_gateway
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const psi = rows[0]
  if (!psi) return { ok: false, error: 'Psicólogo não encontrado.' }

  /*
   * Documento do pagador. `pgm_documento` só existe pra quem passou pelo
   * onboarding de recebimento — e quem compra assinatura vindo da vitrine
   * pública normalmente ainda NÃO passou. Sem o fallback pro `cpf` do cadastro
   * (migration 046), a assinatura ia pra Pagar.me sem documento e a cobrança
   * no cartão fica exposta a recusa por antifraude.
   * Ordem: documento do recebedor primeiro (pode ser o CNPJ de quem atende
   * como PJ, que é quem de fato paga), CPF do cadastro depois.
   */
  const documento = tryDecrypt(psi.pgm_documento) || tryDecrypt(psi.cpf)

  /*
   * TROCA DE PLANO: cancelar a assinatura antiga ANTES de criar a nova.
   * Sem isso, quem sai do Essencial pro Pro ganhava uma segunda assinatura na
   * Pagar.me enquanto o `pagarme_subscription_id` da primeira era sobrescrito
   * — a antiga sumia do nosso banco e seguia cobrando o cartão todo mês, sem
   * ninguém pra cancelá-la. Cobrança dupla vitalícia.
   *
   * Cancelar primeiro (e não depois) é o lado seguro: se a criação da nova
   * falhar, a pessoa não é cobrada em dobro e mantém o acesso ao plano antigo
   * até o fim do ciclo já pago — que é a semântica de `cancelar()`.
   */
  const g = gatewayPadrao()
  const dadosPsi = { id: psicologoId, nome: psi.nome, email: psi.email, documento, telefone: psi.telefone }
  const subAntiga: string | null = psi.assinatura_id ?? null
  const gwAntigo = gatewayDe(psi.assinatura_gateway)

  /*
   * Fatura em aberto do MESMO plano (1ª cobrança não paga, ou renovação
   * recusada no Asaas): devolve a fatura que já existe. Cancelar e criar outra
   * assinatura geraria uma 2ª fatura e perderia a data de vencimento original.
   */
  if (subAntiga && gwAntigo.nome === g.nome && g.faturaEmAberto
      && psi.plano_status === 'inadimplente' && psi.plano === plano && psi.plano_ciclo === ciclo) {
    const url = await g.faturaEmAberto(subAntiga)
    if (url) {
      log.ok('assinatura.assinar', `psicologo=${psicologoId} reabriu a fatura em aberto (${g.nome} sub=${subAntiga})`)
      return { ok: true, plano, urlPagamento: url }
    }
    // Sem fatura em aberto: segue o caminho normal (cancelar + criar).
  }

  /*
   * Mesmo gateway e ele sabe trocar o plano sem cancelar (Asaas: PUT): mantém o
   * cartão guardado. Regra em `calcularTroca`: subir vale na hora com a
   * diferença proporcional na próxima fatura; descer/trocar ciclo vale na
   * renovação. A assinatura no gateway já passa ao valor do DESTINO — é ele que
   * a próxima cobrança paga. Pagar.me não suporta → cancela e cria, como sempre.
   */
  const pago = (x: unknown): x is PlanoPago => x === 'essencial' || x === 'pro'
  if (subAntiga && gwAntigo.nome === g.nome && g.atualizarAssinatura && psi.plano_status === 'ativo' && pago(psi.plano)) {
    const troca = calcularTroca({
      planoAtual: psi.plano, cicloAtual: (psi.plano_ciclo ?? 'mensal') as Ciclo,
      planoNovo: plano, cicloNovo: ciclo, expiraEm: psi.plano_expira_em ?? null,
    })
    const r = await g.atualizarAssinatura(subAntiga, { plano, ciclo, cardToken, psicologo: dadosPsi }, troca.acrescimoCentavos)
    if (r.ok) {
      await db.query(
        `UPDATE psicologos
            SET plano = $2, plano_ciclo = $3,
                plano_agendado = $4::text, plano_ciclo_agendado = $5::text, plano_agendado_vigencia = $6::date,
                plano_atualizado_em = NOW()
          WHERE id = $1`,
        [psicologoId, troca.planoAgora, troca.cicloAgora,
          troca.agendado?.plano ?? null, troca.agendado?.ciclo ?? null, troca.agendado ? r.vencimento : null],
      )
      log.ok('assinatura.assinar', `psicologo=${psicologoId} troca ${troca.tipo}: agora ${troca.planoAgora}/${troca.cicloAgora}`
        + (troca.agendado ? `, ${troca.agendado.plano}/${troca.agendado.ciclo} em ${r.vencimento ?? '?'}` : '')
        + (troca.acrescimoCentavos ? `, +${troca.acrescimoCentavos}c na próxima fatura` : '') + ` (${g.nome} sub=${subAntiga})`)
      return { ok: true, plano: troca.planoAgora, urlPagamento: r.urlPagamento, troca }
    }
    log.err('assinatura.assinar', `troca de plano falhou no ${g.nome} sub=${subAntiga} psicologo=${psicologoId}`)
    return { ok: false, error: 'Não foi possível trocar de plano agora. Tente novamente em alguns minutos.' }
  }

  if (subAntiga) {
    // Cancela no gateway de ORIGEM da assinatura antiga (pode ser outro).
    const cancelou = await gwAntigo.cancelarAssinatura(subAntiga)
    if (!cancelou) {
      log.err('assinatura.assinar', `não cancelou assinatura anterior sub=${subAntiga} psicologo=${psicologoId} — troca abortada pra não cobrar em dobro`)
      return { ok: false, error: 'Não foi possível trocar de plano agora. Tente novamente em alguns minutos.' }
    }
    /*
     * Marca cancelada imediatamente. Se a criação abaixo falhar, a linha não
     * pode continuar 'ativo' com uma assinatura morta na Pagar.me: pela regra
     * de vencimento em `obterAssinatura`, 'ativo' nunca expira — e a conta
     * ficaria com plano pago vitalício de graça.
     */
    await db.query(
      `UPDATE psicologos SET plano_status = 'cancelado', plano_atualizado_em = NOW() WHERE id = $1`,
      [psicologoId],
    )
  }

  let sub
  try {
    sub = await g.criarAssinatura({ plano, ciclo, cardToken, psicologo: dadosPsi })
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err)
    log.err('assinatura.assinar', `falha ${g.nome} ${plano}/${ciclo}`, motivo)
    if (motivo === 'documento_assinante_ausente') {
      return { ok: false, error: 'Para assinar, informe seu CPF em Perfil e tente de novo.' }
    }
    return { ok: false, error: g.nome === 'asaas'
      ? 'Não foi possível iniciar a assinatura agora. Tente novamente em alguns minutos.'
      : 'Não foi possível processar o pagamento. Verifique os dados do cartão e tente novamente.' }
  }

  // expira provisório: +1 mês (mensal) ou +1 ano (anual). Webhook corrige depois.
  const expira = new Date()
  if (ciclo === 'anual') expira.setFullYear(expira.getFullYear() + 1)
  else expira.setMonth(expira.getMonth() + 1)

  // Só libera acesso ('ativo') se o gateway confirmou a assinatura ativa. Se
  // veio 'future'/'failed'/etc, fica 'inadimplente' e o webhook promove quando
  // a fatura for paga — evita liberar plano com cartão recusado.
  const statusInicial = sub.status === 'ativa' ? 'ativo' : 'inadimplente'
  /*
   * Asaas: a 1ª cobrança ainda vai ser paga na fatura. `expira = agora` deixa a
   * conta sem o plano novo até o webhook da 1ª cobrança paga (que grava 'ativo'
   * e o fim do ciclo) — ninguém ganha plano por abrir a fatura e não pagar.
   */
  const expiraEm = sub.status === 'aguardando_pagamento'
    ? new Date().toISOString()
    : (sub.proximaCobranca ?? expira.toISOString())

  await db.query(
    `UPDATE psicologos
        SET plano = $2, plano_status = $6, plano_ciclo = $3,
            assinatura_gateway = $7::text, assinatura_id = $4::text,
            -- Casts explícitos: sem eles o Postgres deduz varchar na atribuição e
            -- text na comparação e recusa ("inconsistent types deduced for parameter").
            pagarme_subscription_id = CASE WHEN $7::text = 'pagarme' THEN $4::text ELSE NULL END,
            plano_expira_em = $5, plano_atualizado_em = NOW()
      WHERE id = $1`,
    [psicologoId, plano, ciclo, sub.assinaturaId, expiraEm, statusInicial, sub.gateway],
  )
  log.ok('assinatura.assinar', `psicologo=${psicologoId} plano=${plano} ${sub.gateway} sub=${sub.assinaturaId} (${sub.status})`)
  return { ok: true, plano, urlPagamento: sub.urlPagamento ?? null }
}

export type SimulacaoTroca = TrocaPlano & {
  /** Próxima cobrança (data em que o valor novo entra). */
  proximaCobranca: string | null
  /** Valor da assinatura a partir da próxima cobrança (centavos). */
  precoNovoCentavos: number
}

/**
 * Prévia da troca para a tela confirmar ANTES (quanto entra na fatura, quando
 * vale). `null` = não é troca no mesmo cartão (sem assinatura ativa, ou
 * Pagar.me) — a tela segue o fluxo de assinar.
 */
export async function simularTroca(psicologoId: string, plano: PlanoPago, ciclo: Ciclo): Promise<SimulacaoTroca | null> {
  const { rows } = await db.query(
    `SELECT plano, plano_ciclo, plano_status, plano_expira_em, assinatura_id, assinatura_gateway
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  if (!r?.assinatura_id || r.plano_status !== 'ativo' || (r.plano !== 'essencial' && r.plano !== 'pro')) return null
  const g = gatewayDe(r.assinatura_gateway)
  if (g.nome !== gatewayPadrao().nome || !g.atualizarAssinatura) return null
  const troca = calcularTroca({
    planoAtual: r.plano, cicloAtual: r.plano_ciclo ?? 'mensal', planoNovo: plano, cicloNovo: ciclo, expiraEm: r.plano_expira_em,
  })
  return {
    ...troca,
    proximaCobranca: r.plano_expira_em ? new Date(r.plano_expira_em).toISOString() : null,
    precoNovoCentavos: precoCentavos(plano, ciclo),
  }
}

/**
 * Link da fatura em aberto da assinatura atual (banner "Pagar fatura").
 * `null` = nada a pagar ou gateway sem fatura navegável (Pagar.me).
 */
export async function faturaEmAberto(psicologoId: string): Promise<string | null> {
  const { rows } = await db.query<{ assinatura_id: string | null; assinatura_gateway: string | null }>(
    `SELECT assinatura_id, assinatura_gateway FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  if (!r?.assinatura_id) return null
  const g = gatewayDe(r.assinatura_gateway)
  return g.faturaEmAberto ? g.faturaEmAberto(r.assinatura_id) : null
}

/**
 * Cancela a assinatura. Mantém o plano e o acesso até `plano_expira_em`
 * (fim do ciclo já pago); status vira 'cancelado'. O downgrade efetivo p/ free
 * acontece quando o ciclo vence (sem nova cobrança → webhook não renova).
 */
export async function cancelar(psicologoId: string): Promise<{ ok: boolean; error?: string }> {
  const { rows } = await db.query<{ assinatura_id: string | null; assinatura_gateway: string | null }>(
    `SELECT COALESCE(assinatura_id, pagarme_subscription_id) AS assinatura_id,
            COALESCE(assinatura_gateway, CASE WHEN pagarme_subscription_id IS NOT NULL THEN 'pagarme' END) AS assinatura_gateway
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const subId = rows[0]?.assinatura_id
  if (!subId) return { ok: false, error: 'Nenhuma assinatura ativa para cancelar.' }

  const ok = await gatewayDe(rows[0]?.assinatura_gateway).cancelarAssinatura(subId)
  if (!ok) return { ok: false, error: 'Não foi possível cancelar agora. Tente novamente.' }

  await db.query(
    `UPDATE psicologos SET plano_status = 'cancelado', plano_atualizado_em = NOW() WHERE id = $1`,
    [psicologoId],
  )
  log.ok('assinatura.cancelar', `psicologo=${psicologoId} sub=${subId}`)
  return { ok: true }
}

/**
 * Aplica um evento de assinatura vindo do webhook Pagar.me, localizando o
 * psicólogo pelo `subscription_id`. Idempotente.
 *
 * - 'renovado' (cobrança ok)  → status 'ativo', estende plano_expira_em.
 * - 'falhou'   (cobrança falhou) → status 'inadimplente' (acesso até expirar).
 * - 'cancelado'                → status 'cancelado'.
 */
export async function aplicarEventoAssinatura(
  subscriptionId: string,
  acao: 'renovado' | 'falhou' | 'cancelado',
  fimCicloIso?: string | null,
  gateway: Gateway = 'pagarme',
  /** Vencimento (AAAA-MM-DD) da cobrança paga — aplica a troca agendada se >= vigência. */
  vencimentoPago?: string | null,
): Promise<void> {
  const { rows } = await db.query<{
    id: string; plano_ciclo: Ciclo | null; plano_status: string | null
    plano_agendado: PlanoPago | null; plano_ciclo_agendado: Ciclo | null; vigencia: string | null
  }>(
    `SELECT id, plano_ciclo, plano_status, plano_agendado, plano_ciclo_agendado,
            to_char(plano_agendado_vigencia, 'YYYY-MM-DD') AS vigencia
       FROM psicologos
      WHERE (assinatura_id = $1 AND COALESCE(assinatura_gateway, 'pagarme') = $2)
         OR ($2 = 'pagarme' AND pagarme_subscription_id = $1)
      LIMIT 1`,
    [subscriptionId, gateway],
  )
  const psi = rows[0]
  if (!psi) {
    log.warn('assinatura.webhook', `subscription ${subscriptionId} sem psicólogo correspondente`)
    return
  }

  if (acao === 'cancelado') {
    await db.query(
      `UPDATE psicologos SET plano_status = 'cancelado', plano_atualizado_em = NOW() WHERE id = $1`,
      [psi.id],
    )
  } else if (acao === 'falhou') {
    await db.query(
      `UPDATE psicologos SET plano_status = 'inadimplente', plano_atualizado_em = NOW() WHERE id = $1`,
      [psi.id],
    )
  } else {
    // renovado: não reativa um plano já cancelado (replay/evento atrasado do
    // Pagar.me não deve ressuscitar acesso que o usuário cancelou; uma nova
    // assinatura real cria outro subscription_id e passa por assinar()).
    if (psi.plano_status === 'cancelado') {
      log.warn('assinatura.webhook', `sub=${subscriptionId} renovado ignorado (plano cancelado)`)
      return
    }
    // Expiry: usa o fim de ciclo do evento SE for válido e futuro, senão calcula.
    // Clampa em (agora + ciclo + 7d) — não aceita data arbitrária do payload
    // (evita expiry no ano 2099 via evento forjado/malformado).
    /*
     * Troca agendada (descer de plano / trocar ciclo) passa a valer quando a
     * cobrança paga é a que já saiu no valor novo. O PAYMENT_RECEIVED de um
     * ciclo ANTERIOR (cartão: ~30 dias após o CONFIRMED) não antecipa a troca.
     */
    const aplicaAgendado = !!psi.plano_agendado &&
      (!psi.vigencia || (!!vencimentoPago && vencimentoPago >= psi.vigencia))
    const cicloEfetivo = aplicaAgendado ? (psi.plano_ciclo_agendado ?? psi.plano_ciclo) : psi.plano_ciclo
    const agora = Date.now()
    const cicloMs = (cicloEfetivo === 'anual' ? 365 : 31) * 86_400_000
    const teto = agora + cicloMs + 7 * 86_400_000
    const doEvento = fimCicloIso ? Date.parse(fimCicloIso) : NaN
    const expiraMs = (!Number.isNaN(doEvento) && doEvento > agora)
      ? Math.min(doEvento, teto)
      : agora + cicloMs
    await db.query(
      `UPDATE psicologos
          SET plano_status = 'ativo', plano_expira_em = $2, plano_atualizado_em = NOW(),
              plano = CASE WHEN $3::boolean THEN plano_agendado ELSE plano END,
              plano_ciclo = CASE WHEN $3::boolean THEN COALESCE(plano_ciclo_agendado, plano_ciclo) ELSE plano_ciclo END,
              plano_agendado = CASE WHEN $3::boolean THEN NULL ELSE plano_agendado END,
              plano_ciclo_agendado = CASE WHEN $3::boolean THEN NULL ELSE plano_ciclo_agendado END,
              plano_agendado_vigencia = CASE WHEN $3::boolean THEN NULL ELSE plano_agendado_vigencia END
        WHERE id = $1`,
      [psi.id, new Date(expiraMs).toISOString(), aplicaAgendado],
    )
    if (aplicaAgendado) log.ok('assinatura.webhook', `sub=${subscriptionId} troca agendada aplicada -> ${psi.plano_agendado}/${cicloEfetivo}`)
  }
  log.ok('assinatura.webhook', `sub=${subscriptionId} acao=${acao}`)
}

/** Dias sem acessar o app após os quais a cortesia volta pro Free. */
export const DIAS_INATIVO_REBAIXA_CORTESIA = 15

/**
 * Rebaixa pro Free quem tem plano de CORTESIA (acima do free, sem assinatura na
 * Pagar.me) e não acessa o app há mais de 15 dias. Regra de out/2026: a cortesia
 * do beta é pra quem está usando; quem parou volta pro Free e pode assinar.
 *
 * "Usou" = último acesso ao app (`ultimo_acesso_em`, atualizado a cada request
 * autenticado, ou `ultimo_login_em`); quem nunca entrou conta da criação da conta.
 * Fica de fora: assinante pagante (tem subscription — quem manda é o webhook) e
 * conta admin (equipe).
 */
export async function rebaixarCortesiasInativas(): Promise<{ id: string; nome: string }[]> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `UPDATE psicologos
        SET plano = 'free', plano_status = 'ativo', plano_ciclo = NULL,
            plano_expira_em = NULL, plano_atualizado_em = NOW()
      WHERE plano <> 'free'
        AND COALESCE(assinatura_id, pagarme_subscription_id) IS NULL
        AND coalesce(role, 'psicologo') <> 'admin'
        AND coalesce(greatest(ultimo_acesso_em, ultimo_login_em), created_at)
            < NOW() - make_interval(days => $1)
      RETURNING id, nome`,
    [DIAS_INATIVO_REBAIXA_CORTESIA],
  )
  if (rows.length) log.warn('assinatura.inativos', `cortesia → free por ${DIAS_INATIVO_REBAIXA_CORTESIA}d sem acesso: ${rows.map(r => r.id).join(', ')}`)
  return rows
}
