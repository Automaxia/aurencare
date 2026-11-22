/**
 * Modelo de resumo personalizado — constantes compartilhadas entre o Perfil
 * (cliente) e a geração do resumo (servidor).
 */

export const MODELO_RESUMO_MAX = 6000
export const MODELO_RESUMO_MIN = 40

/**
 * Ponto de partida do editor ("Começar do padrão"): o modelo da Audere escrito
 * como o psicólogo escreveria — seções, extensão e o que entra em cada uma.
 */
export const MODELO_RESUMO_EXEMPLO = `## 1. Resumo da sessão
~90–130 palavras. Síntese temática (não cronológica) do conteúdo clínico central: tema principal, contexto trazido, técnicas discutidas.

## 2. Encerramento
~40–60 palavras. Como a sessão foi finalizada: feedback do paciente, combinados, tópicos que ficaram em aberto.

## 3. Intervenção do psicólogo
~90–130 palavras. Só o que eu fiz tecnicamente (técnicas, perguntas, validações), com nome técnico quando aplicável.

## 4. Perspectiva do paciente
~90–130 palavras. O que o paciente trouxe, em discurso indireto, incluindo ambivalências.

## 5. Observações
4–5 frases curtas e telegráficas com leituras clínicas sobre padrões, progresso ou risco.

## 6. Sugestões
4–5 frases no infinitivo com orientações práticas ou combinados para a próxima sessão.

Estilo: terceira pessoa, passado, tom técnico. Sem citação literal do paciente.`
