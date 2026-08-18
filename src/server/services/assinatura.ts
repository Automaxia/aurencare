import 'server-only'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { log } from '@/server/lib/log'
import { criarAssinatura, cancelarAssinatura } from '@/server/lib/pagarmeSubscription'
import { PLANOS, capSessoesIa, type Plano, type PlanoPago, type Ciclo } from '@/server/lib/planos'
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
}

/** Estado atual do plano + consumo do mês. Fonte única pro gate, UI e webhook. */
export async function obterAssinatura(psicologoId: string): Promise<AssinaturaInfo> {
  const { rows } = await db.query(
    `SELECT plano, plano_status, plano_ciclo, plano_expira_em, pagarme_subscription_id
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0] ?? {}
  const planoGravado = (r.plano ?? 'free') as Plano
  const subscriptionId = r.pagarme_subscription_id ?? null
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
  const plano: Plano = venceu ? 'free' : planoGravado
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
    cortesiaAte: ehCortesia && !venceu ? expiraEm : null,
  }
}

export type AssinarResult =
  | { ok: true; plano: PlanoPago }
  | { ok: false; error: string }

/**
 * Contrata um plano pago: cria a assinatura recorrente na Pagar.me (cartão
 * tokenizado no front) e persiste o plano. O `expiraEm` é provisório (+1 ciclo);
 * o webhook `subscription.charged` reconcilia a data real a cada renovação.
 */
export async function assinar(
  psicologoId: string, plano: PlanoPago, ciclo: Ciclo, cardToken: string,
): Promise<AssinarResult> {
  const { rows } = await db.query(
    `SELECT nome, email, telefone, pgm_documento, cpf, pagarme_subscription_id FROM psicologos WHERE id = $1 LIMIT 1`,
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
  const subAntiga: string | null = psi.pagarme_subscription_id ?? null
  if (subAntiga) {
    const cancelou = await cancelarAssinatura(subAntiga)
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
    sub = await criarAssinatura({
      plano, ciclo, cardToken,
      psicologo: {
        id: psicologoId,
        nome: psi.nome,
        email: psi.email,
        documento,
        telefone: psi.telefone,
      },
    })
  } catch (err) {
    log.err('assinatura.assinar', `falha Pagar.me ${plano}/${ciclo}`, err instanceof Error ? err.message : err)
    return { ok: false, error: 'Não foi possível processar o pagamento. Verifique os dados do cartão e tente novamente.' }
  }

  // expira provisório: +1 mês (mensal) ou +1 ano (anual). Webhook corrige depois.
  const expira = new Date()
  if (ciclo === 'anual') expira.setFullYear(expira.getFullYear() + 1)
  else expira.setMonth(expira.getMonth() + 1)

  // Só libera acesso ('ativo') se o Pagar.me confirmou a assinatura ativa. Se
  // veio 'future'/'failed'/etc, fica 'inadimplente' e o webhook promove quando
  // a fatura for paga — evita liberar plano com cartão recusado.
  const statusInicial = sub.status === 'active' ? 'ativo' : 'inadimplente'

  await db.query(
    `UPDATE psicologos
        SET plano = $2, plano_status = $6, plano_ciclo = $3,
            pagarme_subscription_id = $4, plano_expira_em = $5, plano_atualizado_em = NOW()
      WHERE id = $1`,
    [psicologoId, plano, ciclo, sub.subscriptionId, sub.proximaCobranca ?? expira.toISOString(), statusInicial],
  )
  log.ok('assinatura.assinar', `psicologo=${psicologoId} plano=${plano} sub=${sub.subscriptionId}`)
  return { ok: true, plano }
}

/**
 * Cancela a assinatura. Mantém o plano e o acesso até `plano_expira_em`
 * (fim do ciclo já pago); status vira 'cancelado'. O downgrade efetivo p/ free
 * acontece quando o ciclo vence (sem nova cobrança → webhook não renova).
 */
export async function cancelar(psicologoId: string): Promise<{ ok: boolean; error?: string }> {
  const { rows } = await db.query<{ pagarme_subscription_id: string | null }>(
    `SELECT pagarme_subscription_id FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const subId = rows[0]?.pagarme_subscription_id
  if (!subId) return { ok: false, error: 'Nenhuma assinatura ativa para cancelar.' }

  const ok = await cancelarAssinatura(subId)
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
): Promise<void> {
  const { rows } = await db.query<{ id: string; plano_ciclo: Ciclo | null; plano_status: string | null }>(
    `SELECT id, plano_ciclo, plano_status FROM psicologos WHERE pagarme_subscription_id = $1 LIMIT 1`,
    [subscriptionId],
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
    const agora = Date.now()
    const cicloMs = (psi.plano_ciclo === 'anual' ? 365 : 31) * 86_400_000
    const teto = agora + cicloMs + 7 * 86_400_000
    const doEvento = fimCicloIso ? Date.parse(fimCicloIso) : NaN
    const expiraMs = (!Number.isNaN(doEvento) && doEvento > agora)
      ? Math.min(doEvento, teto)
      : agora + cicloMs
    await db.query(
      `UPDATE psicologos
          SET plano_status = 'ativo', plano_expira_em = $2, plano_atualizado_em = NOW()
        WHERE id = $1`,
      [psi.id, new Date(expiraMs).toISOString()],
    )
  }
  log.ok('assinatura.webhook', `sub=${subscriptionId} acao=${acao}`)
}
