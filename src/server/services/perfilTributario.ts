import 'server-only'
import { db } from '@/server/db/pool'
import { log } from '@/server/lib/log'

/**
 * Perfil tributário do(a) psicólogo(a).
 *
 * Habilita:
 *  · Estimativa de DAS (PJ Simples) ou Carnê-Leão (autônomo PF)
 *  · ISS por município (alíquota 2-5%)
 *  · Exportação CSV pro contador no formato esperado
 *  · Contato direto pro contador nos relatórios
 */

export type RegimeTributario =
  | 'autonomo_pf'         // Carnê-Leão obrigatório > R$ 2.824/mês (2026)
  | 'pj_simples_anexo3'   // Anexo III — alíquota inicial 6%
  | 'pj_simples_anexo5'   // Anexo V — alíquota inicial 15,5% (sem Fator R)
  | 'pj_lucro_presumido'  // Para faturamentos maiores

export type PerfilTributario = {
  regimeTributario: RegimeTributario | null
  cnae: string                          // default '8650-0/03'
  municipio: string | null
  municipioUf: string | null
  issAliquotaPct: number | null         // 2-5
  issRetidoDefault: boolean
  nomeContador: string | null
  emailContador: string | null
}

export type AtualizarPerfilTributarioInput = Partial<PerfilTributario>
export type AtualizarPerfilTributarioResult =
  | { ok: true }
  | { ok: false; error: string; campo?: keyof PerfilTributario }

export async function lerPerfilTributario(psicologoId: string): Promise<PerfilTributario> {
  const { rows } = await db.query<{
    regime_tributario: string | null
    cnae: string | null
    municipio: string | null
    municipio_uf: string | null
    iss_aliquota_pct: string | null
    iss_retido_default: boolean | null
    nome_contador: string | null
    email_contador: string | null
  }>(
    `SELECT regime_tributario, cnae, municipio, municipio_uf,
            iss_aliquota_pct, iss_retido_default,
            nome_contador, email_contador
       FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  const r = rows[0]
  if (!r) {
    return {
      regimeTributario: null, cnae: '8650-0/03',
      municipio: null, municipioUf: null,
      issAliquotaPct: null, issRetidoDefault: false,
      nomeContador: null, emailContador: null,
    }
  }
  return {
    regimeTributario: (r.regime_tributario ?? null) as RegimeTributario | null,
    cnae: r.cnae ?? '8650-0/03',
    municipio: r.municipio,
    municipioUf: r.municipio_uf,
    issAliquotaPct: r.iss_aliquota_pct != null ? parseFloat(r.iss_aliquota_pct) : null,
    issRetidoDefault: !!r.iss_retido_default,
    nomeContador: r.nome_contador,
    emailContador: r.email_contador,
  }
}

export async function atualizarPerfilTributario(
  psicologoId: string,
  input: AtualizarPerfilTributarioInput,
): Promise<AtualizarPerfilTributarioResult> {
  // Validações
  if (input.regimeTributario !== undefined && input.regimeTributario !== null) {
    const validos: RegimeTributario[] = ['autonomo_pf', 'pj_simples_anexo3', 'pj_simples_anexo5', 'pj_lucro_presumido']
    if (!validos.includes(input.regimeTributario)) {
      return { ok: false, error: 'Regime tributário inválido.', campo: 'regimeTributario' }
    }
  }
  if (input.municipioUf !== undefined && input.municipioUf !== null && input.municipioUf !== '') {
    if (!/^[A-Za-z]{2}$/.test(input.municipioUf)) {
      return { ok: false, error: 'UF deve ter 2 letras (ex: SP, RJ).', campo: 'municipioUf' }
    }
  }
  if (input.issAliquotaPct !== undefined && input.issAliquotaPct !== null) {
    if (input.issAliquotaPct < 0 || input.issAliquotaPct > 10) {
      return { ok: false, error: 'Alíquota ISS deve estar entre 0 e 10%.', campo: 'issAliquotaPct' }
    }
  }
  if (input.emailContador !== undefined && input.emailContador !== null && input.emailContador !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.emailContador)) {
      return { ok: false, error: 'Email do contador inválido.', campo: 'emailContador' }
    }
  }

  // Monta UPDATE dinâmico
  const fields: string[] = []
  const values: any[] = [psicologoId]
  const set = (col: string, v: any) => { fields.push(`${col} = $${values.length + 1}`); values.push(v) }

  if (input.regimeTributario !== undefined) set('regime_tributario', input.regimeTributario)
  if (input.cnae !== undefined)             set('cnae', input.cnae?.trim() || '8650-0/03')
  if (input.municipio !== undefined)        set('municipio', input.municipio?.trim() || null)
  if (input.municipioUf !== undefined)      set('municipio_uf', input.municipioUf?.toUpperCase() || null)
  if (input.issAliquotaPct !== undefined)   set('iss_aliquota_pct', input.issAliquotaPct)
  if (input.issRetidoDefault !== undefined) set('iss_retido_default', !!input.issRetidoDefault)
  if (input.nomeContador !== undefined)     set('nome_contador', input.nomeContador?.trim() || null)
  if (input.emailContador !== undefined)    set('email_contador', input.emailContador?.toLowerCase().trim() || null)

  if (fields.length === 0) return { ok: true }

  try {
    await db.query(
      `UPDATE psicologos SET ${fields.join(', ')} WHERE id = $1`,
      values,
    )
    log.ok('perfilTributario', `atualizado psicologo=${psicologoId}`)
    return { ok: true }
  } catch (err) {
    log.err('perfilTributario', 'falha ao atualizar', err)
    return { ok: false, error: 'Não foi possível salvar agora.' }
  }
}

// ─── Helpers de classificação ────────────────────────────────────────

export function ehAutonomoPf(regime: RegimeTributario | null): boolean {
  return regime === 'autonomo_pf'
}

export function ehPjSimples(regime: RegimeTributario | null): boolean {
  return regime === 'pj_simples_anexo3' || regime === 'pj_simples_anexo5'
}

/**
 * Alíquota INICIAL do Simples Nacional para a faixa 1 (até R$ 180k/ano).
 * Faixas superiores são tratadas como aproximação — para precisão, o
 * contador faz o cálculo final.
 */
export function aliquotaSimplesInicial(regime: RegimeTributario | null): number | null {
  if (regime === 'pj_simples_anexo3') return 6.0
  if (regime === 'pj_simples_anexo5') return 15.5
  return null
}

export const LIMITE_ISENCAO_CARNE_LEAO_2026 = 2824.00  // R$/mês

export const REGIME_LABELS: Record<RegimeTributario, string> = {
  autonomo_pf:        'Autônomo PF · Carnê-Leão / Receita Saúde',
  pj_simples_anexo3:  'PJ Simples Nacional · Anexo III (Fator R)',
  pj_simples_anexo5:  'PJ Simples Nacional · Anexo V',
  pj_lucro_presumido: 'PJ Lucro Presumido',
}
