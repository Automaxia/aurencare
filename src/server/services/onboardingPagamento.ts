import 'server-only'
import { db } from '@/server/db/pool'
import { encrypt, tryDecrypt } from '@/server/lib/crypto'
import { criarRecipient, isRecipientMock, type RecipientInput, PagarmeRecipientError, type CampoRecusado } from '@/server/lib/pagarmeRecipient'
import { log } from '@/server/lib/log'
import { cpfCnpjValido, validarCpf, validarCnpj } from '@/lib/documento'

export type OnboardingStatus = {
  /**
   * Onboarding utilizável para cobrar de verdade. Um recipient `mock_rcp_*`
   * (gravado enquanto a integração rodava em modo mock) conta como INCOMPLETO —
   * ele não existe na Pagar.me e derrubaria a order no split.
   */
  completo: boolean
  recipientId: string | null
  concluidoEm: string | null
  /**
   * Concluiu o onboarding, mas o recipient é sintético: precisa refazer para
   * que o dinheiro caia na conta dele em vez da conta-mãe da plataforma.
   */
  recipientInvalido: boolean
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'celular' | 'aleatoria'

/** Endereço do recebedor — obrigatório na Pagar.me para PF e PJ. */
export type EnderecoOnboarding = {
  cep: string
  logradouro: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string
}

/** Sócio administrador — obrigatório para PJ (`managing_partners`). */
export type SocioOnboarding = {
  nome: string
  cpf: string
  dataNascimento: string
  email: string
  telefone: string
  rendaMensalCentavos: number
}

export type OnboardingInput = {
  tipoPessoa: 'PF' | 'PJ'
  documento: string
  razaoSocial: string
  dataNascimento: string
  rendaCentavos: number
  /** Obrigatório nos dois tipos. */
  endereco: EnderecoOnboarding
  /** Obrigatório quando PJ. */
  socio?: SocioOnboarding | null
  banco: {
    codigo: string
    agencia: string
    agenciaDv?: string | null
    conta: string
    contaDv: string
    tipo: 'corrente' | 'poupanca'
    titularNome: string
    titularDocumento: string
  }
  /** Chave PIX opcional — usada como preferência de recebimento. */
  chavePix?: {
    tipo: TipoChavePix
    valor: string
  } | null
}

export type CampoErro =
  | 'tipoPessoa' | 'documento' | 'razaoSocial' | 'dataNascimento' | 'rendaCentavos'
  | 'bancoCodigo' | 'bancoAgencia' | 'bancoConta' | 'bancoContaDv' | 'bancoTipo'
  | 'titularNome' | 'titularDocumento'
  | 'chavePixTipo' | 'chavePixValor'
  | 'endCep' | 'endLogradouro' | 'endNumero' | 'endBairro' | 'endCidade' | 'endUf'
  | 'socioNome' | 'socioCpf' | 'socioNascimento' | 'socioEmail' | 'socioTelefone'

export type SalvarResult =
  | { ok: true; recipientId: string }
  | { ok: false; error: string; campo?: CampoErro }

export async function lerStatusOnboarding(psicologoId: string): Promise<OnboardingStatus> {
  const { rows } = await db.query<{ pagarme_recipient_id: string | null; pgm_onboarding_em: string | null }>(
    `SELECT pagarme_recipient_id, pgm_onboarding_em
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  const mock = isRecipientMock(r?.pagarme_recipient_id)
  return {
    completo: !!r?.pgm_onboarding_em && !mock,
    recipientId: mock ? null : (r?.pagarme_recipient_id ?? null),
    concluidoEm: r?.pgm_onboarding_em ?? null,
    recipientInvalido: !!r?.pgm_onboarding_em && mock,
  }
}

export type OnboardingDetalhes = {
  completo: boolean
  /**
   * Cadastro preenchido, mas o recebedor é sintético (`mock_rcp_*`, do período
   * em modo mock): o dinheiro do paciente cai na conta-mãe da plataforma, não
   * na dele. Precisa refazer o onboarding.
   */
  recipientInvalido: boolean
  tipoPessoa: 'PF' | 'PJ' | null
  documentoMasc: string | null     // ***.***.123-45
  razaoSocial: string | null
  dataNascimento: string | null    // YYYY-MM-DD
  banco: {
    codigo: string | null
    agencia: string | null
    contaMasc: string | null       // últimos 4 dígitos visíveis
    tipo: 'corrente' | 'poupanca' | null
    titularNome: string | null
  }
  chavePix: { tipo: TipoChavePix; valorMasc: string } | null
}

/**
 * Lê os detalhes cadastrados para exibir na aba "Recebimentos" do Perfil.
 * Documentos e chave PIX são mascarados — psicóloga vê só o suficiente
 * para confirmar que é o cadastro certo, sem expor o valor completo na UI.
 */
export async function lerOnboardingDetalhes(psicologoId: string): Promise<OnboardingDetalhes> {
  const { rows } = await db.query<any>(
    `SELECT pgm_tipo_pessoa, pgm_documento, pgm_razao_social, pgm_data_nascimento,
            pgm_banco_codigo, pgm_banco_agencia, pgm_banco_agencia_dv,
            pgm_banco_conta, pgm_banco_conta_dv, pgm_banco_tipo, pgm_titular_nome,
            pgm_chave_pix_tipo, pgm_chave_pix_valor,
            pgm_onboarding_em, pagarme_recipient_id
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  if (!r) {
    return { completo: false, recipientInvalido: false, tipoPessoa: null, documentoMasc: null, razaoSocial: null, dataNascimento: null,
      banco: { codigo: null, agencia: null, contaMasc: null, tipo: null, titularNome: null }, chavePix: null }
  }

  const docPlain = r.pgm_documento ? tryDecrypt(r.pgm_documento) : null
  const conta = r.pgm_banco_conta ? `${r.pgm_banco_conta}${r.pgm_banco_conta_dv ? '-' + r.pgm_banco_conta_dv : ''}` : null
  const agencia = r.pgm_banco_agencia ? `${r.pgm_banco_agencia}${r.pgm_banco_agencia_dv ? '-' + r.pgm_banco_agencia_dv : ''}` : null

  let chavePix: OnboardingDetalhes['chavePix'] = null
  if (r.pgm_chave_pix_tipo && r.pgm_chave_pix_valor) {
    const v = tryDecrypt(r.pgm_chave_pix_valor) ?? ''
    chavePix = { tipo: r.pgm_chave_pix_tipo as TipoChavePix, valorMasc: mascararChavePix(r.pgm_chave_pix_tipo, v) }
  }

  return {
    completo: !!r.pgm_onboarding_em,
    recipientInvalido: !!r.pgm_onboarding_em && isRecipientMock(r.pagarme_recipient_id),
    tipoPessoa: r.pgm_tipo_pessoa,
    documentoMasc: docPlain ? mascararDoc(docPlain) : null,
    razaoSocial: r.pgm_razao_social,
    dataNascimento: r.pgm_data_nascimento ? new Date(r.pgm_data_nascimento).toISOString().slice(0, 10) : null,
    banco: {
      codigo: r.pgm_banco_codigo,
      agencia,
      contaMasc: conta ? mascararConta(conta) : null,
      tipo: r.pgm_banco_tipo,
      titularNome: r.pgm_titular_nome,
    },
    chavePix,
  }
}

export type AtualizarChavePixResult =
  | { ok: true }
  | { ok: false; error: string; campo?: 'chavePixTipo' | 'chavePixValor' }

/**
 * Atualiza/remove apenas a chave PIX cadastrada. Não chama Pagar.me —
 * a chave hoje é só preferência local. Quando Pagar.me suportar repasse
 * via PIX, esse service propaga.
 */
export async function atualizarChavePix(
  psicologoId: string,
  chave: { tipo: TipoChavePix; valor: string } | null,
): Promise<AtualizarChavePixResult> {
  if (chave) {
    const tipos: TipoChavePix[] = ['cpf', 'cnpj', 'email', 'celular', 'aleatoria']
    if (!tipos.includes(chave.tipo))
      return { ok: false, error: 'Tipo de chave PIX inválido.', campo: 'chavePixTipo' }
    if (!chavePixValida(chave.tipo, chave.valor))
      return { ok: false, error: motivoChavePix(chave.tipo), campo: 'chavePixValor' }
  }

  const valorEnc = chave ? encrypt(normalizarChavePix(chave.tipo, chave.valor)) : null
  await db.query(
    `UPDATE psicologos
        SET pgm_chave_pix_tipo = $2, pgm_chave_pix_valor = $3
      WHERE id = $1`,
    [psicologoId, chave?.tipo ?? null, valorEnc],
  )
  log.ok('onboardingPagamento', `chave pix ${chave ? 'atualizada' : 'removida'} psicologo=${psicologoId}`)
  return { ok: true }
}

function mascararDoc(doc: string): string {
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) return `***.***.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return '***'
}
function mascararConta(conta: string): string {
  const d = conta.replace(/\D/g, '')
  if (d.length <= 4) return d
  return `••••${d.slice(-4)}${conta.includes('-') ? '' : ''}`
}
function mascararChavePix(tipo: string, valor: string): string {
  if (tipo === 'email') {
    const [u, dom] = valor.split('@')
    if (!u || !dom) return valor
    return `${u.slice(0, 2)}${u.length > 2 ? '•••' : ''}@${dom}`
  }
  if (tipo === 'aleatoria') return `${valor.slice(0, 8)}-••••-••••-••••-••••${valor.slice(-4)}`
  if (tipo === 'celular') {
    const d = valor.replace(/\D/g, '')
    return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`
  }
  return mascararDoc(valor)
}

/**
 * Traduz o campo recusado pela Pagar.me para o campo do NOSSO formulário.
 *
 * Sem isso a tela dizia "verifique a conta bancária" para qualquer recusa —
 * inclusive CEP inválido ou sócio faltando. A pessoa revisava a conta bancária,
 * que estava certa, e desistia. Mesmo problema que o CPF do paciente tinha.
 *
 * A ordem importa: `managing_partners` e `address` são testados ANTES dos
 * genéricos (`document`, `name`), senão o caminho
 * `register_information.managing_partners[0].document` cairia em "documento".
 */
const RECUSA_PARA_CAMPO: [RegExp, CampoErro, string][] = [
  // ── sócio administrador (PJ) ──
  [/managing_partners.*document/i,   'socioCpf',        'A Pagar.me não aceitou o CPF do sócio administrador. Confira os dígitos.'],
  [/managing_partners.*name/i,       'socioNome',       'A Pagar.me não aceitou o nome do sócio administrador — informe o nome completo, como consta no documento.'],
  [/managing_partners.*birthdate/i,  'socioNascimento', 'Data de nascimento do sócio administrador inválida ou incompatível com o CPF informado.'],
  [/managing_partners.*email/i,      'socioEmail',      'A Pagar.me não aceitou o email do sócio administrador.'],
  [/managing_partners.*phone/i,      'socioTelefone',   'A Pagar.me não aceitou o telefone do sócio administrador. Use DDD + número.'],
  [/managing_partners/i,             'socioNome',       'A Pagar.me recusou os dados do sócio administrador. Revise nome, CPF, nascimento, email e telefone.'],
  // ── endereço ──
  [/address.*zip_?code/i,            'endCep',          'CEP recusado pela Pagar.me. Confira os 8 dígitos.'],
  [/address.*street_?number/i,       'endNumero',       'Número do endereço recusado pela Pagar.me.'],
  [/address.*street/i,               'endLogradouro',   'Logradouro recusado pela Pagar.me. Escreva o nome da rua sem abreviar.'],
  [/address.*neighborhood/i,         'endBairro',       'Bairro recusado pela Pagar.me.'],
  [/address.*city/i,                 'endCidade',       'Cidade recusada pela Pagar.me — confira a grafia.'],
  [/address.*state/i,                'endUf',           'UF recusada pela Pagar.me. Use a sigla de 2 letras (ex.: SP).'],
  [/address/i,                       'endCep',          'A Pagar.me recusou o endereço. Revise CEP, rua, número, bairro, cidade e UF.'],
  // ── conta bancária ──
  [/holder_?document/i,              'titularDocumento','O documento do titular não bate com a conta bancária. Em conta PJ o titular é o CNPJ; em conta PF, o CPF.'],
  [/holder_?name/i,                  'titularNome',     'Nome do titular recusado pela Pagar.me — precisa ser igual ao do banco.'],
  [/holder_?type/i,                  'titularDocumento','Tipo de titular incompatível: conta de pessoa física exige CPF; de empresa, CNPJ.'],
  [/branch_?check_?digit/i,          'bancoAgencia',    'Dígito da agência recusado. Se a agência não tem dígito, deixe o campo vazio.'],
  [/branch_?number/i,                'bancoAgencia',    'Agência recusada pela Pagar.me. Informe só os números da agência; o dígito vai no campo ao lado.'],
  [/account_?check_?digit/i,         'bancoContaDv',    'Dígito da conta recusado pela Pagar.me.'],
  [/account_?number/i,               'bancoConta',      'Número da conta recusado pela Pagar.me. Informe sem o dígito.'],
  [/\bbank\b/i,                      'bancoCodigo',     'Banco não reconhecido pela Pagar.me. Use o código de compensação (ex.: 341, 001, 237).'],
  [/bank_?account.*type|account.*type/i, 'bancoTipo',   'Tipo de conta recusado (corrente/poupança).'],
  // ── dados do recebedor ──
  [/birthdate|founding_?date/i,      'dataNascimento',  'Data recusada pela Pagar.me — confira se bate com o documento informado.'],
  [/monthly_?income|annual_?revenue/i,'rendaCentavos',  'Renda/faturamento recusado pela Pagar.me.'],
  [/company_?name|trading_?name/i,   'razaoSocial',     'Razão social recusada pela Pagar.me — precisa ser igual à da Receita.'],
  [/\bdocument\b/i,                  'documento',       'A Pagar.me não aceitou seu CPF/CNPJ. Confira os dígitos.'],
  [/\bname\b/i,                      'razaoSocial',     'Nome recusado pela Pagar.me — informe o nome completo, como no documento.'],
]

export function traduzirRecusa(campos: CampoRecusado[]): { error: string; campo?: CampoErro } {
  for (const c of campos) {
    const alvo = `${c.caminho} ${c.mensagens.join(' ')}`
    for (const [re, campo, msg] of RECUSA_PARA_CAMPO) {
      if (re.test(alvo)) return { error: msg, campo }
    }
  }
  // Recusa que não sabemos mapear: mostra o que a Pagar.me disse, em vez de
  // apontar o dedo pra conta bancária sem base.
  const bruto = campos[0]?.mensagens[0]
  return {
    error: bruto
      ? `A Pagar.me recusou o cadastro: ${bruto}`
      : 'Não foi possível registrar seus dados no Pagar.me. Tente novamente em alguns minutos.',
  }
}

export async function salvarOnboarding(psicologoId: string, input: OnboardingInput): Promise<SalvarResult> {
  const v = validar(input)
  if (v) return { ok: false, error: v.error, campo: v.campo }

  // Lê dados que viram default no Recipient (email, telefone, nome)
  const { rows } = await db.query<{ nome: string; email: string; telefone: string | null }>(
    `SELECT nome, email, telefone FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const psi = rows[0]
  if (!psi) return { ok: false, error: 'Psicóloga não encontrada.' }
  if (!psi.telefone) return { ok: false, error: 'Telefone faltando no cadastro. Atualize no Perfil antes.' }

  const docNum = input.documento.replace(/\D/g, '')
  const titularDocNum = input.banco.titularDocumento.replace(/\D/g, '')

  const enderecoLimpo = {
    cep: input.endereco.cep.replace(/\D/g, ''),
    logradouro: input.endereco.logradouro.trim(),
    numero: input.endereco.numero.trim(),
    complemento: input.endereco.complemento?.trim() || null,
    bairro: input.endereco.bairro.trim(),
    cidade: input.endereco.cidade.trim(),
    uf: input.endereco.uf.trim().toUpperCase(),
  }
  const socioCpfNum = input.socio ? input.socio.cpf.replace(/\D/g, '') : null

  const recipientInput: RecipientInput = {
    tipoPessoa: input.tipoPessoa,
    documento: docNum,
    razaoSocial: input.razaoSocial.trim(),
    email: psi.email,
    telefone: psi.telefone,
    dataNascimento: input.dataNascimento,
    rendaCentavos: input.rendaCentavos,
    endereco: enderecoLimpo,
    // O sócio herda o endereço da empresa — a Pagar.me exige um endereço por
    // sócio, mas pedir dois no formulário seria atrito sem ganho prático.
    socio: input.socio
      ? {
          nome: input.socio.nome.trim(),
          cpf: socioCpfNum!,
          dataNascimento: input.socio.dataNascimento,
          email: input.socio.email.trim(),
          telefone: input.socio.telefone.replace(/\D/g, ''),
          rendaMensalCentavos: input.socio.rendaMensalCentavos,
          endereco: enderecoLimpo,
        }
      : null,
    banco: {
      codigo: input.banco.codigo,
      agencia: input.banco.agencia.replace(/\D/g, ''),
      agenciaDv: input.banco.agenciaDv?.replace(/\D/g, '') || null,
      conta: input.banco.conta.replace(/\D/g, ''),
      contaDv: input.banco.contaDv.replace(/\D/g, ''),
      tipo: input.banco.tipo,
      titularNome: input.banco.titularNome.trim(),
      titularDocumento: titularDocNum,
    },
  }

  let recipientId: string
  try {
    const r = await criarRecipient(recipientInput)
    recipientId = r.recipientId
  } catch (err) {
    if (err instanceof PagarmeRecipientError) {
      const t = traduzirRecusa(err.campos)
      log.err('onboardingPagamento', `pagar.me recusou — campo=${t.campo ?? 'desconhecido'}`, err.detalhe)
      return { ok: false, error: t.error, campo: t.campo }
    }
    log.err('onboardingPagamento', 'pagar.me recusou', err)
    return { ok: false, error: 'Não foi possível registrar seus dados no Pagar.me. Tente novamente em alguns minutos.' }
  }

  const chavePixTipo = input.chavePix?.tipo ?? null
  const chavePixValor = input.chavePix ? encrypt(normalizarChavePix(input.chavePix.tipo, input.chavePix.valor)) : null

  try {
    await db.query(
      `UPDATE psicologos SET
         pagarme_recipient_id = $2,
         pgm_tipo_pessoa = $3,
         pgm_documento = $4,
         pgm_razao_social = $5,
         pgm_data_nascimento = $6,
         pgm_renda_centavos = $7,
         pgm_banco_codigo = $8,
         pgm_banco_agencia = $9,
         pgm_banco_agencia_dv = $10,
         pgm_banco_conta = $11,
         pgm_banco_conta_dv = $12,
         pgm_banco_tipo = $13,
         pgm_titular_nome = $14,
         pgm_titular_documento = $15,
         pgm_chave_pix_tipo = $16,
         pgm_chave_pix_valor = $17,
         pgm_end_cep = $18,
         pgm_end_logradouro = $19,
         pgm_end_numero = $20,
         pgm_end_complemento = $21,
         pgm_end_bairro = $22,
         pgm_end_cidade = $23,
         pgm_end_uf = $24,
         pgm_socio_nome = $25,
         pgm_socio_cpf = $26,
         pgm_socio_nascimento = $27,
         pgm_socio_email = $28,
         pgm_socio_telefone = $29,
         pgm_socio_renda_centavos = $30,
         -- Na PF o documento do recebedor É o CPF da pessoa: aproveita pra
         -- preencher a identificação fiscal de quem se cadastrou antes de o
         -- campo existir. COALESCE e não atribuição direta — o CPF do cadastro
         -- é a fonte de verdade; aqui só se tapa buraco. Na PJ o documento é
         -- CNPJ e $31 vem null, então nada muda.
         cpf = COALESCE(cpf, $31),
         pgm_onboarding_em = NOW()
       WHERE id = $1`,
      [
        psicologoId, recipientId, input.tipoPessoa,
        encrypt(docNum), input.razaoSocial.trim(), input.dataNascimento, input.rendaCentavos,
        input.banco.codigo, input.banco.agencia.replace(/\D/g, ''), input.banco.agenciaDv?.replace(/\D/g, '') || null,
        input.banco.conta.replace(/\D/g, ''), input.banco.contaDv.replace(/\D/g, ''),
        input.banco.tipo, input.banco.titularNome.trim(), encrypt(titularDocNum),
        chavePixTipo, chavePixValor,
        enderecoLimpo.cep, enderecoLimpo.logradouro, enderecoLimpo.numero, enderecoLimpo.complemento,
        enderecoLimpo.bairro, enderecoLimpo.cidade, enderecoLimpo.uf,
        input.socio?.nome.trim() ?? null,
        socioCpfNum ? encrypt(socioCpfNum) : null,
        input.socio?.dataNascimento ?? null,
        input.socio?.email.trim() ?? null,
        input.socio?.telefone.replace(/\D/g, '') ?? null,
        input.socio?.rendaMensalCentavos ?? null,
        input.tipoPessoa === 'PF' ? encrypt(docNum) : null,
      ],
    )
    log.ok('onboardingPagamento', `concluído psicologo=${psicologoId} recipient=${recipientId}`)
    return { ok: true, recipientId }
  } catch (err) {
    log.err('onboardingPagamento', 'falha ao persistir', err)
    return { ok: false, error: 'Recebedor criado, mas não conseguimos salvar seus dados. Suporte foi notificado.' }
  }
}

function validar(input: OnboardingInput): { error: string; campo: CampoErro } | null {
  if (input.tipoPessoa !== 'PF' && input.tipoPessoa !== 'PJ')
    return { error: 'Escolha PF ou PJ.', campo: 'tipoPessoa' }

  const doc = input.documento.replace(/\D/g, '')
  if (input.tipoPessoa === 'PF' && doc.length !== 11)
    return { error: 'CPF deve ter 11 dígitos.', campo: 'documento' }
  if (input.tipoPessoa === 'PJ' && doc.length !== 14)
    return { error: 'CNPJ deve ter 14 dígitos.', campo: 'documento' }
  if (!cpfCnpjValido(doc))
    return { error: 'Documento inválido — verifique os dígitos.', campo: 'documento' }

  if (input.razaoSocial.trim().length < 3)
    return { error: input.tipoPessoa === 'PF' ? 'Informe o nome civil.' : 'Informe a razão social.', campo: 'razaoSocial' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataNascimento))
    return { error: 'Data inválida.', campo: 'dataNascimento' }
  const dt = new Date(input.dataNascimento + 'T00:00:00Z')
  if (Number.isNaN(+dt))
    return { error: 'Data inválida.', campo: 'dataNascimento' }
  if (input.tipoPessoa === 'PF') {
    const anos = (Date.now() - +dt) / (365.25 * 86_400_000)
    if (anos < 18) return { error: 'Idade mínima 18 anos.', campo: 'dataNascimento' }
  }

  if (!Number.isFinite(input.rendaCentavos) || input.rendaCentavos < 100_000)
    return { error: 'Informe uma renda/faturamento estimado (mínimo R$ 1.000).', campo: 'rendaCentavos' }

  // Endereço — exigido pela Pagar.me nos dois tipos (address / main_address).
  const end = input.endereco
  if (!end) return { error: 'Informe o endereço.', campo: 'endCep' }
  if (end.cep.replace(/\D/g, '').length !== 8)
    return { error: 'CEP deve ter 8 dígitos.', campo: 'endCep' }
  if (end.logradouro.trim().length < 3)
    return { error: 'Informe o logradouro.', campo: 'endLogradouro' }
  if (!end.numero.trim())
    return { error: 'Informe o número (use S/N se não houver).', campo: 'endNumero' }
  if (end.bairro.trim().length < 2)
    return { error: 'Informe o bairro.', campo: 'endBairro' }
  if (end.cidade.trim().length < 2)
    return { error: 'Informe a cidade.', campo: 'endCidade' }
  if (!/^[A-Za-z]{2}$/.test(end.uf.trim()))
    return { error: 'UF deve ter 2 letras (ex.: DF).', campo: 'endUf' }

  // Sócio administrador — a Pagar.me exige ao menos um para PJ.
  if (input.tipoPessoa === 'PJ') {
    const s = input.socio
    if (!s) return { error: 'Informe o sócio administrador da empresa.', campo: 'socioNome' }
    if (s.nome.trim().split(/\s+/).length < 2)
      return { error: 'Informe o nome completo do sócio.', campo: 'socioNome' }
    const scpf = s.cpf.replace(/\D/g, '')
    if (scpf.length !== 11 || !cpfCnpjValido(scpf))
      return { error: 'CPF do sócio inválido.', campo: 'socioCpf' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dataNascimento))
      return { error: 'Data de nascimento do sócio inválida.', campo: 'socioNascimento' }
    const anosSocio = (Date.now() - +new Date(s.dataNascimento + 'T00:00:00Z')) / (365.25 * 86_400_000)
    if (!(anosSocio >= 18))
      return { error: 'O sócio precisa ter ao menos 18 anos.', campo: 'socioNascimento' }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email.trim()))
      return { error: 'Email do sócio inválido.', campo: 'socioEmail' }
    if (s.telefone.replace(/\D/g, '').length < 10)
      return { error: 'Telefone do sócio inválido (com DDD).', campo: 'socioTelefone' }
  }

  if (!input.banco.codigo || !/^\d{2,4}$/.test(input.banco.codigo))
    return { error: 'Escolha o banco.', campo: 'bancoCodigo' }
  if (!input.banco.agencia.replace(/\D/g, ''))
    return { error: 'Agência obrigatória.', campo: 'bancoAgencia' }
  if (!input.banco.conta.replace(/\D/g, ''))
    return { error: 'Conta obrigatória.', campo: 'bancoConta' }
  if (!input.banco.contaDv.replace(/\D/g, ''))
    return { error: 'Dígito da conta obrigatório.', campo: 'bancoContaDv' }
  if (input.banco.tipo !== 'corrente' && input.banco.tipo !== 'poupanca')
    return { error: 'Escolha o tipo de conta.', campo: 'bancoTipo' }
  if (input.banco.titularNome.trim().length < 3)
    return { error: 'Informe o nome do titular.', campo: 'titularNome' }
  const titDoc = input.banco.titularDocumento.replace(/\D/g, '')
  if (titDoc.length !== 11 && titDoc.length !== 14)
    return { error: 'CPF ou CNPJ do titular inválido.', campo: 'titularDocumento' }
  if (!cpfCnpjValido(titDoc))
    return { error: 'Documento do titular inválido.', campo: 'titularDocumento' }

  if (input.chavePix) {
    const tipos: TipoChavePix[] = ['cpf', 'cnpj', 'email', 'celular', 'aleatoria']
    if (!tipos.includes(input.chavePix.tipo))
      return { error: 'Tipo de chave PIX inválido.', campo: 'chavePixTipo' }
    if (!chavePixValida(input.chavePix.tipo, input.chavePix.valor))
      return { error: motivoChavePix(input.chavePix.tipo), campo: 'chavePixValor' }
  }

  return null
}

function chavePixValida(tipo: TipoChavePix, valor: string): boolean {
  const v = valor.trim()
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  if (tipo === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  const d = v.replace(/\D/g, '')
  if (tipo === 'cpf')     return d.length === 11 && validarCpf(d)
  if (tipo === 'cnpj')    return d.length === 14 && validarCnpj(d)
  if (tipo === 'celular') return d.length === 10 || d.length === 11
  return false
}
function motivoChavePix(tipo: TipoChavePix): string {
  return ({
    cpf: 'CPF da chave PIX inválido.',
    cnpj: 'CNPJ da chave PIX inválido.',
    email: 'Email da chave PIX inválido.',
    celular: 'Celular da chave PIX inválido (use DDD + número).',
    aleatoria: 'Chave aleatória deve estar no formato UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
  } as Record<TipoChavePix, string>)[tipo]
}
function normalizarChavePix(tipo: TipoChavePix, valor: string): string {
  const v = valor.trim()
  if (tipo === 'email') return v.toLowerCase()
  if (tipo === 'aleatoria') return v.toLowerCase()
  return v.replace(/\D/g, '')   // cpf, cnpj, celular: só dígitos
}


