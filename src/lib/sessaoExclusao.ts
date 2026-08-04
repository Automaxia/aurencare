/**
 * Regra de "dá pra excluir esta sessão?" — fonte única, usada nos três lugares
 * que precisam dela: a guarda autoritativa do servidor (`excluirSessao`), as
 * páginas server que montam as listas, e os botões no cliente.
 *
 * Fica em `src/lib` (e não em `src/server`) de propósito: componente client não
 * importa módulo `server-only`, e duplicar a regra no cliente é como ela sai do
 * ar com o servidor.
 */

/** Uma sessão está VAZIA quando não sobrou nada de prontuário nela. */
export type CamposRegistro = {
  assinada: boolean
  transcricao?: string | null
  notaClinica?: string | null
  resumoIa?: string | null
  resumoCurto?: string | null
  laudo?: string | null
}

export function sessaoVazia(s: CamposRegistro): boolean {
  return !s.assinada && !s.transcricao && !s.notaClinica
    && !s.resumoIa && !s.resumoCurto && !s.laudo
}

export type GuardasExclusao = {
  status: string
  /** Assinatura ou qualquer texto clínico — o oposto de `sessaoVazia`. */
  temRegistro: boolean
  pagamentoStatus: string
  /** Cobrança gerada e ainda pendente (PIX/checkout aberto). */
  temCobrancaAberta: boolean
}

/**
 * Espelha exatamente as guardas de `excluirSessao`. Na UI serve só pra não
 * oferecer um botão que vai falhar — o servidor revalida tudo de novo.
 *
 * `em_curso` fica de fora porque a transcrição ainda pode chegar: o caminho é
 * destravar/encerrar antes.
 */
export function podeExcluirSessao(g: GuardasExclusao): boolean {
  return !g.temRegistro
    && g.status !== 'em_curso'
    && g.pagamentoStatus !== 'pago'
    && !g.temCobrancaAberta
}

/**
 * Versões SQL das duas condições acima, pra quem monta a lista direto no banco
 * sem trazer os blobs cifrados (transcrição inteira) só pra checar se são nulos.
 * São ESPELHO de `sessaoVazia` e de `temCobrancaAberta` — mexeu num, mexe no
 * outro. Ficam juntas aqui pra a divergência ficar visível.
 *
 * `alias` prefixa as colunas quando a query tem JOIN (ex.: `sqlTemRegistro('s')`).
 * Não interpola entrada de usuário — só nome de tabela escrito no código.
 *
 * COALESCE não é decoração: `assinada` e `pagamento_status` são nullable no
 * schema (DEFAULT, sem NOT NULL). Sem ele uma linha com NULL faria a expressão
 * inteira virar NULL, e o `NOT (…)` do DELETE nunca casaria — a sessão ficaria
 * impossível de excluir, com mensagem de erro errada.
 */
export function sqlTemRegistro(alias = ''): string {
  const c = alias ? `${alias}.` : ''
  return `(COALESCE(${c}assinada, FALSE)
    OR ${c}transcricao_texto IS NOT NULL
    OR ${c}nota_clinica      IS NOT NULL
    OR ${c}resumo_ia         IS NOT NULL
    OR ${c}resumo_curto      IS NOT NULL
    OR ${c}laudo             IS NOT NULL)`
}

export function sqlTemCobrancaAberta(alias = ''): string {
  const c = alias ? `${alias}.` : ''
  return `(${c}pagarme_order_id IS NOT NULL AND COALESCE(${c}pagamento_status, '') = 'pendente')`
}

/**
 * `indicadores` é sempre gravado no encerrar (ritmo/humor/risco/notaRapida com
 * defaults), então "existe" não quer dizer "tem conteúdo". Só conta o que a
 * psicóloga digitou/marcou de propósito: nota rápida ou risco acima de baixo.
 *
 * Não bloqueia a exclusão — vira aviso na confirmação, porque some junto no
 * DELETE e não há tela pra limpar esses campos depois.
 */
export function temAnotacaoViva(indicadores: unknown): boolean {
  if (!indicadores || typeof indicadores !== 'object') return false
  const ind = indicadores as Record<string, any>
  if (typeof ind.notaRapida === 'string' && ind.notaRapida.trim()) return true
  const r = ind.risco
  return !!r && ['autolesao', 'ideacao', 'plano'].some(k => r[k] && r[k] !== 'lo')
}
