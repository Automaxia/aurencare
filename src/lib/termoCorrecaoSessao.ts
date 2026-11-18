/**
 * Termo de responsabilidade das correções de sessão com registro clínico.
 * Fica em src/lib porque o cliente MOSTRA e o servidor GRAVA o mesmo texto
 * (congelado no log junto com a versão). Mudou o texto → suba a versão.
 */

export const TERMO_CORRECAO_VERSAO = '2026-11-v1'

export type AcaoCorrecao = 'transferir_registro' | 'excluir'

export function termoCorrecao(acao: AcaoCorrecao, p: {
  psicologoNome: string
  crp: string
  pacienteOrigem: string
  pacienteDestino?: string
  sessaoNumero: number
  sessaoData: string
}): string {
  const acaoTxt = acao === 'transferir_registro'
    ? `a TRANSFERÊNCIA do registro clínico da sessão nº ${p.sessaoNumero} de ${p.sessaoData}, hoje vinculada a ${p.pacienteOrigem}, para o prontuário de ${p.pacienteDestino}`
    : `a EXCLUSÃO da sessão nº ${p.sessaoNumero} de ${p.sessaoData} do prontuário de ${p.pacienteOrigem}`
  return [
    `Eu, ${p.psicologoNome}, CRP ${p.crp}, solicito ${acaoTxt}.`,
    'Declaro que esta correção é necessária por erro de registro, que conferi as informações envolvidas e que a decisão é exclusivamente minha, no exercício da minha responsabilidade técnica e ética sobre os documentos que produzo (Resolução CFP nº 001/2009 e Código de Ética Profissional do Psicólogo).',
    acao === 'excluir'
      ? 'Estou ciente de que a sessão deixará de aparecer no prontuário e nos indicadores, mas uma cópia íntegra será mantida em arquivo restrito pelo prazo legal de guarda de documentos, podendo ser apresentada em caso de fiscalização, auditoria ou ordem judicial.'
      : 'Estou ciente de que a agenda e o pagamento da sessão original não são alterados, de que o registro passará a constar no prontuário do paciente de destino e de que ele volta como rascunho, devendo ser revisado e assinado novamente por mim.',
    'Estou ciente de que esta ação fica registrada com data, hora, endereço de rede e este termo, e que respondo integralmente por ela, isentando a plataforma Audere de responsabilidade por seu uso indevido.',
  ].join('\n\n')
}
