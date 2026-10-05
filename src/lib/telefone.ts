/**
 * Telefone com país (client + server safe).
 *
 * Convenção de armazenamento (inalterada — tel_canon e o UNIQUE dependem dela):
 *   Brasil        → só dígitos, DDD + número, sem o 55   ex: 61999423445
 *   Internacional → E.164 com '+'                        ex: +351912345678
 */
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

export type Pais = { iso: CountryCode; nome: string; bandeira: string; ddi: string }

function pais(iso: CountryCode, nome: string): Pais {
  const bandeira = String.fromCodePoint(...[...iso].map(c => 0x1f1a5 + c.charCodeAt(0)))
  return { iso, nome, bandeira, ddi: getCountryCallingCode(iso) }
}

// Brasil primeiro; depois os destinos mais comuns de brasileiros no exterior; resto em ordem alfabética.
export const PAISES: Pais[] = [
  pais('BR', 'Brasil'),
  pais('PT', 'Portugal'),
  pais('US', 'Estados Unidos'),
  pais('GB', 'Reino Unido'),
  pais('IE', 'Irlanda'),
  pais('ES', 'Espanha'),
  pais('IT', 'Itália'),
  pais('DE', 'Alemanha'),
  pais('FR', 'França'),
  pais('CA', 'Canadá'),
  pais('JP', 'Japão'),
  pais('AU', 'Austrália'),
  ...([
    ['AR', 'Argentina'], ['AT', 'Áustria'], ['BE', 'Bélgica'], ['BO', 'Bolívia'], ['CL', 'Chile'],
    ['CO', 'Colômbia'], ['DK', 'Dinamarca'], ['AE', 'Emirados Árabes'], ['EC', 'Equador'],
    ['FI', 'Finlândia'], ['NL', 'Holanda'], ['IL', 'Israel'], ['LU', 'Luxemburgo'], ['MX', 'México'],
    ['MZ', 'Moçambique'], ['NO', 'Noruega'], ['NZ', 'Nova Zelândia'], ['AO', 'Angola'],
    ['PY', 'Paraguai'], ['PE', 'Peru'], ['PL', 'Polônia'], ['SE', 'Suécia'], ['CH', 'Suíça'],
    ['UY', 'Uruguai'], ['VE', 'Venezuela'],
  ] as [CountryCode, string][]).map(([iso, nome]) => pais(iso, nome)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
]

const PAIS_BR = PAISES[0]

/** Formata enquanto digita, no padrão do país escolhido (só a parte nacional). */
export function mascaraNacional(iso: CountryCode, digitos: string): string {
  const d = digitos.replace(/\D/g, '')
  if (!d) return ''
  return new AsYouType(iso).input(d)
}

/** Só dígitos, preservando o '+' do internacional (+1, +351…). Sem '+' assume Brasil. */
export function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return raw.trim().startsWith('+') ? `+${d}` : d
}

/** País + número nacional → valor a gravar (ver convenção no topo). */
export function montarTelefone(iso: CountryCode, nacional: string): string {
  const d = nacional.replace(/\D/g, '')
  if (!d) return ''
  if (iso === 'BR') return d
  const p = parsePhoneNumberFromString(d, iso)
  return p ? p.number : `+${getCountryCallingCode(iso)}${d}`
}

/** Valor gravado → país + número nacional (pra reabrir o campo na edição). */
export function separarTelefone(armazenado: string | null | undefined): { iso: CountryCode; nacional: string } {
  const raw = (armazenado ?? '').trim()
  if (!raw.startsWith('+')) {
    const d = raw.replace(/\D/g, '')
    // Registro antigo gravado com o 55 na frente.
    return { iso: 'BR', nacional: d.startsWith('55') && d.length >= 12 ? d.slice(2) : d }
  }
  const p = parsePhoneNumberFromString(raw)
  if (p?.country) return { iso: p.country, nacional: p.nationalNumber }
  // DDI fora do metadado: acha o país da lista pelo prefixo mais longo.
  const d = raw.replace(/\D/g, '')
  const achado = PAISES.filter(x => d.startsWith(x.ddi)).sort((a, b) => b.ddi.length - a.ddi.length)[0]
  return achado ? { iso: achado.iso, nacional: d.slice(achado.ddi.length) } : { iso: PAIS_BR.iso, nacional: d }
}

/** Valida o número no padrão do país. BR mantém a regra antiga (DDD + 8/9 dígitos). */
export function validarTelefone(armazenado: string): string | null {
  const raw = armazenado.trim()
  if (!raw.startsWith('+')) {
    const d = raw.replace(/\D/g, '')
    const br = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
    return br.length === 10 || br.length === 11 ? null : 'Telefone inválido (DDD + número).'
  }
  const p = parsePhoneNumberFromString(raw)
  if (!p || !p.isPossible()) return 'Telefone inválido para o país selecionado.'
  return null
}

/**
 * Exibição. Aceita o valor gravado e também números crus vindos do WhatsApp
 * (dígitos com DDI e sem '+', ex: 5561999423445 ou 351912345678).
 */
export function formatarTelefone(raw: string | null | undefined): string {
  if (!raw) return ''
  const t = raw.trim()
  const d = t.replace(/\D/g, '')
  if (!t.startsWith('+')) {
    const br = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
    if (br.length === 11) return `(${br.slice(0, 2)}) ${br.slice(2, 7)}-${br.slice(7)}`
    if (br.length === 10) return `(${br.slice(0, 2)}) ${br.slice(2, 6)}-${br.slice(6)}`
    if (d.length < 10) return t
  }
  const p = parsePhoneNumberFromString(`+${d}`)
  return p ? p.formatInternational() : t
}

/** Número pro link wa.me (E.164 sem '+'). Mesma regra de paraNumeroMeta/toNumber. */
export function telefoneWaMe(armazenado: string): string {
  const d = armazenado.replace(/\D/g, '')
  if (armazenado.trim().startsWith('+')) return d
  return d.startsWith('55') ? d : `55${d}`
}

/**
 * `mobile_phone` do customer da Pagar.me. BR: DDD + número. Exterior: DDI do país
 * e o número nacional (os 2 primeiros dígitos vão em area_code, que a API exige).
 * Antes o 55 era fixo e um número de Portugal virava DDD "91" brasileiro.
 */
export function telefonePagarme(armazenado: string): { country_code: string; area_code: string; number: string } {
  const raw = armazenado.trim()
  if (raw.startsWith('+')) {
    const p = parsePhoneNumberFromString(raw)
    if (p && p.countryCallingCode !== '55') {
      const n = p.nationalNumber
      return { country_code: p.countryCallingCode, area_code: n.slice(0, 2), number: n.slice(2) }
    }
  }
  const d = raw.replace(/\D/g, '')
  return { country_code: '55', area_code: d.slice(-11, -9), number: d.slice(-9) }
}
