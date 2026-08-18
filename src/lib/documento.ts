/**
 * Validação de CPF/CNPJ por dígito verificador.
 *
 * Fonte única: o onboarding de recebimento (psicólogo) e o cadastro do paciente
 * validam o mesmo documento com o mesmo código. Um CPF de paciente inválido
 * chega até a Pagar.me e reprova a charge do PIX — a order volta sem `qr_code`
 * e o paciente receberia um link vazio. Barrar no cadastro é mais barato.
 */

export function apenasDigitos(doc: string | null | undefined): string {
  return (doc ?? '').replace(/\D/g, '')
}

export function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
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

export function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
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

export function cpfCnpjValido(doc: string): boolean {
  if (doc.length === 11) return validarCpf(doc)
  if (doc.length === 14) return validarCnpj(doc)
  return false
}

/** `123.456.789-09` — para exibir sem reescrever a máscara em cada tela. */
export function formatarCpf(cpf: string): string {
  const d = apenasDigitos(cpf)
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}
