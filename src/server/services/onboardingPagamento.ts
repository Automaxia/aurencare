import 'server-only'
import { db } from '@/server/db/pool'
import { encrypt, tryDecrypt } from '@/server/lib/crypto'
import { criarRecipient, type RecipientInput } from '@/server/lib/pagarmeRecipient'
import { log } from '@/server/lib/log'

export type OnboardingStatus = {
  completo: boolean
  recipientId: string | null
  concluidoEm: string | null
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'celular' | 'aleatoria'

export type OnboardingInput = {
  tipoPessoa: 'PF' | 'PJ'
  documento: string
  razaoSocial: string
  dataNascimento: string
  rendaCentavos: number
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
  return {
    completo: !!r?.pgm_onboarding_em,
    recipientId: r?.pagarme_recipient_id ?? null,
    concluidoEm: r?.pgm_onboarding_em ?? null,
  }
}

export type OnboardingDetalhes = {
  completo: boolean
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
            pgm_onboarding_em
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  if (!r) {
    return { completo: false, tipoPessoa: null, documentoMasc: null, razaoSocial: null, dataNascimento: null,
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

  const recipientInput: RecipientInput = {
    tipoPessoa: input.tipoPessoa,
    documento: docNum,
    razaoSocial: input.razaoSocial.trim(),
    email: psi.email,
    telefone: psi.telefone,
    dataNascimento: input.dataNascimento,
    rendaCentavos: input.rendaCentavos,
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
    log.err('onboardingPagamento', 'pagar.me recusou', err)
    return { ok: false, error: 'Não foi possível registrar seus dados no Pagar.me. Verifique a conta bancária e tente novamente.' }
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
         pgm_onboarding_em = NOW()
       WHERE id = $1`,
      [
        psicologoId, recipientId, input.tipoPessoa,
        encrypt(docNum), input.razaoSocial.trim(), input.dataNascimento, input.rendaCentavos,
        input.banco.codigo, input.banco.agencia.replace(/\D/g, ''), input.banco.agenciaDv?.replace(/\D/g, '') || null,
        input.banco.conta.replace(/\D/g, ''), input.banco.contaDv.replace(/\D/g, ''),
        input.banco.tipo, input.banco.titularNome.trim(), encrypt(titularDocNum),
        chavePixTipo, chavePixValor,
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

/**
 * Validação de CPF (11) ou CNPJ (14) usando dígitos verificadores oficiais.
 */
function cpfCnpjValido(doc: string): boolean {
  if (doc.length === 11) return validarCpf(doc)
  if (doc.length === 14) return validarCnpj(doc)
  return false
}
function validarCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i)
  let d = (s * 10) % 11
  if (d === 10) d = 0
  if (d !== +cpf[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i)
  d = (s * 10) % 11
  if (d === 10) d = 0
  return d === +cpf[10]
}
function validarCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const pesos2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  let s = 0
  for (let i = 0; i < 12; i++) s += +cnpj[i] * pesos1[i]
  let d = s % 11
  d = d < 2 ? 0 : 11 - d
  if (d !== +cnpj[12]) return false
  s = 0
  for (let i = 0; i < 13; i++) s += +cnpj[i] * pesos2[i]
  d = s % 11
  d = d < 2 ? 0 : 11 - d
  return d === +cnpj[13]
}
