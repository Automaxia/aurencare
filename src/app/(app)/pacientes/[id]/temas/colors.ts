/** Cores dos clusters do grafo de temas — módulo isolado (sem 'use client' nem
 *  imports pesados) pra poder ser usado tanto na página quanto no palco da
 *  videochamada (bundle público do paciente) sem arrastar a view/o chat junto. */
export const CLUSTER_COLORS: Record<string, string> = {
  emocional:   '#6a4ec8',
  relacional:  '#c4607a',
  situacional: '#5a9e8a',
  cognitivo:   '#b07d40',
}
