import 'server-only'
import { db } from '@/server/db/pool'

/**
 * Blocos de PERFIL do paciente (dados cadastrais/sociodemográficos +
 * condições clínicas registradas) para alimentar o contexto factual das
 * análises de IA — prontuário e evolução longitudinal.
 *
 * Fonte: pacientes.dados_cadastro (JSONB) e pacientes.condicoes (JSONB).
 */

/**
 * Dados cadastrais/sociodemográficos relevantes pra leitura clínica.
 * Omite CPF de propósito: identificador administrativo, sensível e sem valor
 * analítico. Contatos de emergência entram só como contagem (rede de apoio),
 * sem expor PII de terceiros.
 */
export function formatCadastrais(dc: any): string | null {
  if (!dc || typeof dc !== 'object') return null
  const partes: string[] = []
  const add = (rotulo: string, v: any) => { if (v != null && String(v).trim()) partes.push(`${rotulo}: ${String(v).trim()}`) }
  add('Nome social', dc.nomeSocial)
  add('Gênero', dc.genero)
  add('Raça/cor', dc.racaCor)
  add('Estado civil', dc.estadoCivil)
  add('Ocupação', dc.ocupacao)
  add('Formação', dc.formacao)
  const local = [dc.cidade, dc.estado, dc.pais].filter((x: any) => x && String(x).trim()).join(', ')
  if (local) partes.push(`Localização: ${local}`)
  add('Como chegou', dc.origem)
  const contatos = Array.isArray(dc.contatosEmergencia)
    ? dc.contatosEmergencia.filter((c: any) => c && (c.nome || c.telefone || c.email)).length
    : 0
  if (contatos > 0) partes.push(`Contatos de emergência cadastrados: ${contatos}`)
  return partes.length > 0 ? partes.map(p => `- ${p}`).join('\n') : null
}

/**
 * Condições clínicas registradas pelo profissional (pacientes.condicoes).
 * Defensivo quanto à forma do JSONB (cid/medicações podem ser array ou string).
 */
export function formatClinicas(c: any): string | null {
  if (!c || typeof c !== 'object') return null
  const linhas: string[] = []

  const cid = Array.isArray(c.cid) ? c.cid.filter(Boolean) : (c.cid ? [c.cid] : [])
  if (cid.length) linhas.push(`- CID-10 registrado: ${cid.join(', ')}`)

  const meds = Array.isArray(c.medicacoes) ? c.medicacoes : []
  const medsFmt = meds.map((m: any) =>
    typeof m === 'string' ? m : `${m?.nome ?? ''}${m?.dose ? ` (${m.dose})` : ''}`.trim(),
  ).filter(Boolean)
  if (medsFmt.length) linhas.push(`- Medicações: ${medsFmt.join('; ')}`)

  const alertas = Array.isArray(c.alertas) ? c.alertas.filter(Boolean) : (c.alertas ? [c.alertas] : [])
  if (alertas.length) linhas.push(`- Alertas: ${alertas.join('; ')}`)

  if (c.observacoes && String(c.observacoes).trim()) linhas.push(`- Observações: ${String(c.observacoes).trim()}`)

  return linhas.length > 0 ? linhas.join('\n') : null
}

/**
 * Monta os blocos de perfil (cadastrais + clínicas) já formatados como seções
 * markdown, prontos pra concatenar no grounding factual de um chat de IA.
 * Retorna '' quando não há nada registrado. Verifica ownership.
 */
export async function blocoPerfilParaIa(pacienteId: string, psicologoId: string): Promise<string> {
  const { rows } = await db.query<{ condicoes: any; dados_cadastro: any }>(
    `SELECT condicoes, dados_cadastro FROM pacientes WHERE id = $1 AND psicologo_id = $2 LIMIT 1`,
    [pacienteId, psicologoId],
  )
  if (rows.length === 0) return ''

  const secoes: string[] = []
  const cad = formatCadastrais(rows[0].dados_cadastro)
  if (cad) secoes.push(`## Dados cadastrais / sociodemográficos\n${cad}`)
  const clin = formatClinicas(rows[0].condicoes)
  if (clin) secoes.push(`## Informações clínicas registradas (pelo profissional)\n${clin}`)

  return secoes.length > 0 ? secoes.join('\n\n') : ''
}
