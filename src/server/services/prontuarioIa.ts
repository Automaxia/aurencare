import 'server-only'
import { chat, type ChatMessage } from '@/server/lib/anthropic'
import { CLINICAL_VOICE } from '@/server/lib/clinicalVoice'
import { coletarDadosProntuario } from './prontuarioExport'

/**
 * Chat IA para redação de prontuário em linguagem natural.
 *
 * A IA é assistente (§2 CLAUDE.md + CFP 09/2024): sempre rascunho, sempre
 * revisão da psicóloga. O texto gerado passa por validarTextoIA dentro do
 * helper `chat()` — se um termo proibido escapar, é sanitizado.
 *
 * Contexto: usa coletarDadosProntuario com os mesmos dados do template
 * formal, mas formatados como prompt textual.
 */

const SYS_PRONTUARIO_NARRATIVO = `${CLINICAL_VOICE}

TAREFA: você é a IA assistente do Audere ajudando a psicóloga a redigir o prontuário em LINGUAGEM NATURAL/narrativa, em formato de texto corrido (NÃO tabelas, NÃO bullets, salvo se ela pedir explicitamente).

PRINCÍPIOS:
- O texto que você gerar é SEMPRE rascunho. A psicóloga revisa e assina.
- Use vocabulário descritivo-observacional. NUNCA emita diagnóstico, interpretação clínica ou recomendação terapêutica.
- Cite NÚMEROS DE SESSÃO quando comparar (ex: "desde a sessão #3", "aumento na sessão #7").
- Ancorar afirmações em evidência factual presente no contexto fornecido — não inventar.
- Português brasileiro formal mas humano.

REGRAS DE INTERAÇÃO:
- Em cada resposta, comece com o texto solicitado (sem prefácio do tipo "claro, aqui está").
- Se a psicóloga pedir alterações, refaça o texto inteiro reescrito (não diffs).
- Se faltar informação no contexto pra atender o pedido, diga isso claramente.

LIMITES:
- Máximo ~400 palavras por resposta, salvo se a psicóloga pedir mais.
- Nunca prescrever ação ("deveria", "precisa fazer"). Sugerir direções observacionais.
- Em casos de risco mencionados, citar a evidência textual e sugerir VIGILÂNCIA, não conduta clínica.`

/**
 * Monta o bloco de contexto factual que vai junto da primeira mensagem.
 * Trunca pra caber no limite de tokens.
 */
async function montarContexto(psicologoId: string, pacienteId: string): Promise<string | null> {
  const d = await coletarDadosProntuario(psicologoId, pacienteId, { incluirTranscricoes: false })
  if (!d) return null

  const linhas: string[] = []
  linhas.push(`PACIENTE: ${d.paciente.nome}`)
  linhas.push(`PROFISSIONAL RESPONSÁVEL: ${d.psicologo.nome} (${d.psicologo.crp})`)
  linhas.push(`ATENDIMENTO INICIADO EM: ${new Date(d.paciente.cadastradoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
  linhas.push(`SESSÕES ASSINADAS: ${d.totaisAssinadas}`)
  linhas.push('')

  const cad = formatCadastrais(d.paciente.dadosCadastro)
  if (cad) {
    linhas.push('## Dados cadastrais / sociodemográficos')
    linhas.push(cad)
    linhas.push('')
  }

  const clin = formatClinicas(d.paciente.condicoes)
  if (clin) {
    linhas.push('## Informações clínicas registradas (pelo profissional)')
    linhas.push(clin)
    linhas.push('')
  }

  if (d.sessoes.length > 0) {
    linhas.push('## Histórico de sessões assinadas')
    // Inclui até as últimas 20 sessões pra controlar tokens
    const ultimas = d.sessoes.slice(-20)
    for (const s of ultimas) {
      const data = new Date(s.dataHora).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      linhas.push(`Sessão #${s.numero} (${data}, ${s.duracaoMin}min, ${s.modalidade}):`)
      if (s.resumo) linhas.push(s.resumo)
      if (s.indicadores) {
        const ind = formatIndicadores(s.indicadores)
        if (ind) linhas.push(`Indicadores: ${ind}`)
      }
      linhas.push('')
    }
    if (d.sessoes.length > 20) {
      linhas.unshift(`(Mostrando últimas 20 sessões. Total registradas: ${d.sessoes.length}.)\n`)
    }
  }

  if (d.objetivos.length > 0) {
    linhas.push('## Objetivos terapêuticos')
    for (const o of d.objetivos) {
      linhas.push(`- ${o.titulo} (${o.status}, ${o.progresso}% do trajeto)`)
      if (o.metricaTipo === 'absoluta' && o.metricaBaseline != null && o.metricaAlvo != null) {
        linhas.push(`  Métrica: ${o.metricaUnidade} · de ${o.metricaBaseline} para ${o.metricaAlvo} (${o.metricaDirecao})`)
      } else if (o.metricaTipo === 'gas') {
        linhas.push(`  Métrica: GAS (Goal Attainment Scale -2 a +2)`)
      }
      if (o.descricao) linhas.push(`  Contexto: ${o.descricao}`)
      if (o.medicoes.length > 0) {
        const ultV = o.medicoes[o.medicoes.length - 1]
        linhas.push(`  Última medição: ${ultV.valor} em ${new Date(ultV.data + 'T00:00:00').toLocaleDateString('pt-BR')}`)
      }
    }
    linhas.push('')
  }

  if (d.marcos.length > 0) {
    linhas.push('## Marcos do processo (extraídos das sessões)')
    for (const m of d.marcos) {
      linhas.push(`- Sessão #${m.numero}, ${m.tipo}: ${m.titulo}. ${m.descricao}`)
    }
  }

  return linhas.join('\n')
}

function formatIndicadores(ind: any): string | null {
  const partes: string[] = []
  const ritmo = ind?.ritmo
  if (ritmo?.psicologo != null) partes.push(`ritmo psic ${ritmo.psicologo}%/pac ${ritmo.paciente}%`)
  const humor = ind?.humor
  if (humor?.estado != null) partes.push(`humor estado ${humor.estado}`)
  const risco = ind?.risco
  if (risco) {
    const high = ['autolesao', 'ideacao', 'plano'].some(k => risco[k] === 'hi')
    const med  = ['autolesao', 'ideacao', 'plano'].some(k => risco[k] === 'md')
    if (high) partes.push('risco alto')
    else if (med) partes.push('risco médio')
  }
  return partes.length > 0 ? partes.join(' · ') : null
}

/**
 * Dados cadastrais/sociodemográficos relevantes pra leitura clínica.
 * Omite CPF de propósito: é identificador administrativo, sem valor analítico
 * e sensível — não entra no contexto da IA. Contatos de emergência entram só
 * como contagem (rede de apoio), sem expor PII de terceiros.
 */
function formatCadastrais(dc: any): string | null {
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
function formatClinicas(c: any): string | null {
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

export type ProntuarioIaInput = {
  psicologoId: string
  pacienteId: string
  /** Histórico de mensagens (excluindo o system prompt). */
  messages: ChatMessage[]
}

export type ProntuarioIaResult =
  | { ok: true; resposta: string; contextoIncluido: boolean }
  | { ok: false; error: string }

/**
 * Chama Anthropic com o contexto do paciente + system prompt clínico.
 * A primeira mensagem da conversa SEMPRE recebe o contexto factual prefixado.
 */
export async function chatProntuarioIa(input: ProntuarioIaInput): Promise<ProntuarioIaResult> {
  if (input.messages.length === 0) {
    return { ok: false, error: 'Histórico vazio.' }
  }

  let messages = input.messages
  let contextoIncluido = false

  // Se a primeira mensagem do usuário ainda não tem contexto injetado,
  // prefixa com os dados clínicos do paciente.
  if (input.messages[0].role === 'user' && !input.messages[0].content.startsWith('## Contexto clínico')) {
    const ctx = await montarContexto(input.psicologoId, input.pacienteId)
    if (!ctx) return { ok: false, error: 'Não foi possível carregar os dados do paciente.' }
    const primeira = input.messages[0]
    const primeiraComCtx: ChatMessage = {
      role: 'user',
      content: `## Contexto clínico do(a) paciente\n\n${ctx}\n\n---\n\n## Pedido\n\n${primeira.content}`,
    }
    messages = [primeiraComCtx, ...input.messages.slice(1)]
    contextoIncluido = true
  }

  try {
    const resposta = await chat(SYS_PRONTUARIO_NARRATIVO, messages, {
      scope: 'prontuario.ia',
      maxTokens: 1200,
      model: 'strong',
    })
    return { ok: true, resposta, contextoIncluido }
  } catch (err) {
    return { ok: false, error: 'Falha ao gerar texto agora.' }
  }
}

/**
 * Sugestões iniciais (botões prontos) — orientam o uso típico.
 */
export const SUGESTOES_INICIAIS = [
  {
    label: 'Resumo geral do tratamento',
    prompt: 'Gere um resumo geral do tratamento até o momento — temas recorrentes, evolução dos objetivos e marcos relevantes. Texto corrido de 2-3 parágrafos.',
  },
  {
    label: 'Progresso dos últimos 3 meses',
    prompt: 'Faça uma síntese do progresso clínico observável nos últimos 3 meses, citando sessões específicas quando relevante. Mantenha linguagem descritiva.',
  },
  {
    label: 'Foco em um tema',
    prompt: 'Quero focar em um tema específico do prontuário. Pergunte-me qual tema antes de gerar.',
  },
  {
    label: 'Versão pra supervisão clínica',
    prompt: 'Redija um texto sucinto pra apresentar em supervisão clínica: identificação do caso, formulação observacional, intervenções utilizadas e ponto atual. Manter linguagem descritiva.',
  },
]
