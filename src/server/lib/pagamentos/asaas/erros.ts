/**
 * Recusas do Asaas → campo do wizard de recebimento (RF-PG-16).
 *
 * O Asaas responde `{ errors: [{ code: 'invalid_object', description: '…' }] }`
 * com a descrição já em português e sem caminho de campo — o mapeamento é pela
 * descrição. A mensagem original é mostrada: ela é melhor que qualquer paráfrase.
 */
export type CampoWizard =
  | 'documento' | 'razaoSocial' | 'dataNascimento' | 'rendaCentavos'
  | 'endCep' | 'endLogradouro' | 'endNumero' | 'endBairro' | 'endCidade' | 'endUf'

const TABELA: [RegExp, CampoWizard | null][] = [
  [/\bCEP\b|postalCode/i, 'endCep'],
  [/CPF|CNPJ|cpfCnpj/i, 'documento'],
  [/nascimento|birthDate/i, 'dataNascimento'],
  [/renda|faturamento|incomeValue/i, 'rendaCentavos'],
  [/bairro|province/i, 'endBairro'],
  [/n[úu]mero do endere[çc]o|addressNumber/i, 'endNumero'],
  [/endere[çc]o|logradouro|\baddress\b/i, 'endLogradouro'],
  [/tipo de empresa|companyType/i, 'razaoSocial'],
  [/\bnome\b|\bname\b/i, 'razaoSocial'],
  // e-mail e celular vêm do cadastro do psicólogo, não do wizard
  [/e-?mail|telefone|celular|mobilePhone/i, null],
]

export function traduzirRecusaAsaas(descricoes: string[], status: number | null): { error: string; campo?: CampoWizard } {
  for (const d of descricoes) {
    for (const [re, campo] of TABELA) {
      if (!re.test(d)) continue
      if (campo === null) {
        return { error: `O Asaas recusou o cadastro: ${d} — atualize em Perfil e tente de novo.` }
      }
      return { error: `O Asaas recusou: ${d}`, campo }
    }
  }
  if (status === 401 || status === 403) {
    return { error: `Nosso acesso ao Asaas foi recusado (${status}). Não é problema nos seus dados — o suporte já foi avisado.` }
  }
  const bruto = descricoes[0]
  return {
    error: bruto
      ? `O Asaas recusou o cadastro (${status ?? 'erro'}): ${bruto}`
      : 'Não foi possível registrar seus dados no Asaas. Tente novamente em alguns minutos.',
  }
}
