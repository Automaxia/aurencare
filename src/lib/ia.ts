// Client-safe (sem 'server-only'): compartilhado entre back (anthropic.ts) e
// front (chats, pós-sessão). Detecta quando a IA não devolveu conteúdo real
// (sem chave, erro de API, saldo de crédito esgotado) pra mostrar um estado
// amigável em vez do texto cru com colchetes.

export const IA_SEM_CHAVE = '[Resposta de IA indisponível neste ambiente — configure ANTHROPIC_API_KEY em .env.local.]'
export const IA_FALHA = '[Não foi possível gerar a resposta de IA agora.]'

/** Mensagem amigável pra mostrar ao usuário quando a IA está fora. */
export const MSG_IA_INDISPONIVEL = 'A inteligência da Audere está temporariamente indisponível. Tente novamente em alguns minutos.'

/** True se o texto é um placeholder de IA indisponível (não é conteúdo real). */
export function iaIndisponivel(texto: string | null | undefined): boolean {
  if (!texto) return true
  const t = texto.trim()
  return t === IA_SEM_CHAVE || t === IA_FALHA
}
