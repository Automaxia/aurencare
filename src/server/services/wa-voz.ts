import 'server-only'
import { chat } from '@/server/lib/anthropic'

/**
 * "Voz da clínica" — gera o texto de cada mensagem WhatsApp.
 *
 * Princípios (do CLAUDE.md + pedido da psicóloga):
 *   acolhedora · segura · clara · NÃO bajuladora · respeita LGPD ·
 *   sem jargão clínico · português brasileiro coloquial-respeitoso.
 */

const SYS_VOZ = `Você é a assistente de WhatsApp de um(a) profissional de psicologia clínica. Escreve mensagens curtas para pacientes e potenciais pacientes.

GÊNERO: você não sabe o gênero do profissional. Refira-se a ele(a) SEMPRE pelo NOME, sem artigo de gênero (ex: "com Ana", "com Luiz", "Ana vai te responder"), nunca "a psicóloga"/"o psicólogo"/"a Ana"/"o Luiz".

TOM:
- Acolhedora, mas não bajuladora. Nunca "que ótimo que você está aqui!", "estou tão feliz!", "incrível ver você dar esse passo".
- Segura: clara, direta, transmite calma.
- Respeitosa: trate como adulto. Sem infantilizar.
- Calorosa em pequenos detalhes (nome, "boa tarde", "obrigada"), nunca em efusividade.
- NUNCA emita diagnóstico, opinião clínica, conselho terapêutico ou hipótese sobre o paciente.
- Use português brasileiro coloquial-respeitoso (3ª pessoa "você", não "tu", não "senhora").

FORMATO:
- Máximo 3 frases, idealmente 1-2.
- Sem emoji em excesso — no máximo 1 por mensagem, e só quando ajuda na clareza (✓, ⏳, →).
- Sem markdown (não está num app que renderiza). Quebra de linha simples.
- Use *negrito do WhatsApp* (asteriscos) só pra destacar instrução curta tipo *PIX* ou *CONFIRMAR*.
- Não termine com "Estou aqui se precisar" / "Conte comigo" / "Vou estar aqui pra você".

PRIVACIDADE:
- Quando pedir dados sensíveis, lembre brevemente que os dados ficam criptografados e não saem do consultório.
- LGPD: paciente sempre pode pedir pra apagar. Não escrever isso em toda mensagem — só quando pedir consentimento explicitamente.

Você receberá uma INTENT + um CONTEXTO. Retorne SOMENTE o texto da mensagem, sem prosa em volta, sem aspas.`

export type Intent =
  | { kind: 'saudacao_inicial';        contexto: { psicologoNome: string } }
  | { kind: 'pedir_nome';              contexto: { psicologoNome: string } }
  | { kind: 'recebeu_nome';            contexto: { primeiroNome: string } }
  | { kind: 'pedir_email';             contexto: { primeiroNome: string } }
  | { kind: 'pedir_consentimento';     contexto: { primeiroNome: string; psicologoNome: string } }
  | { kind: 'consent_aceito_onboarded'; contexto: { primeiroNome: string; psicologoNome: string } }
  | { kind: 'consent_recusado';        contexto: { primeiroNome: string } }
  | { kind: 'paciente_reconhecido';    contexto: { primeiroNome: string } }
  | { kind: 'nao_entendi';             contexto: {} }
  | { kind: 'erro_tecnico';            contexto: {} }

/** Gera o texto da mensagem via Claude. */
export async function gerarMensagem(intent: Intent): Promise<string> {
  const userMsg = `INTENT: ${intent.kind}
CONTEXTO: ${JSON.stringify(intent.contexto)}

Escreva a mensagem.`

  const texto = await chat(SYS_VOZ, [{ role: 'user', content: userMsg }], {
    scope: `wa.voz.${intent.kind}`,
    maxTokens: 220,
  })

  // Defensive: remove aspas envolvendo + collapse de linhas em branco
  return texto
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 600)
}

/**
 * Fallback determinístico — usado quando ANTHROPIC_API_KEY não está configurada
 * (a função `chat` retorna placeholder; aqui detectamos e usamos texto fixo).
 */
export function fallbackParaIntent(intent: Intent): string {
  switch (intent.kind) {
    case 'saudacao_inicial':
      return `Olá! Sou da equipe de ${intent.contexto.psicologoNome}. Pra começar, qual seu primeiro nome?`
    case 'pedir_nome':
      return `Como posso te chamar? (primeiro nome)`
    case 'recebeu_nome':
      return `Anotado, ${intent.contexto.primeiroNome}.`
    case 'pedir_email':
      return `Quer me passar um email pra recibo? Se preferir pular, é só responder *pular*.`
    case 'pedir_consentimento':
      return `${intent.contexto.primeiroNome}, antes de marcarmos qualquer coisa: ${intent.contexto.psicologoNome} segue a LGPD e os dados ficam criptografados, sem treinamento de IA.\n\nResponda *SIM* pra confirmar que concorda, ou *NÃO* se quiser pensar mais.`
    case 'consent_aceito_onboarded':
      return `Pronto, ${intent.contexto.primeiroNome}. ${intent.contexto.psicologoNome} já recebeu sua confirmação e vai te enviar próximos passos por aqui.`
    case 'consent_recusado':
      return `Sem problema, ${intent.contexto.primeiroNome}. Se mudar de ideia, é só me mandar uma mensagem.`
    case 'paciente_reconhecido':
      return `Oi, ${intent.contexto.primeiroNome}. Recebi sua mensagem — sua psicóloga foi avisada.`
    case 'nao_entendi':
      return `Não entendi muito bem. Pode reescrever?`
    case 'erro_tecnico':
      return `Tivemos um problema técnico agora. Sua psicóloga foi avisada e vai te responder por aqui.`
  }
}

/**
 * Tenta gerar com IA; cai em fallback determinístico se a resposta for placeholder.
 */
export async function gerarMensagemSegura(intent: Intent): Promise<string> {
  const texto = await gerarMensagem(intent)
  if (!texto || texto.startsWith('[Resposta de IA') || texto.startsWith('[Não foi possível')) {
    return fallbackParaIntent(intent)
  }
  return texto
}
