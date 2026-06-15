import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { env, integrationStatus } from './env'
import { log } from './log'
import { validarTextoIA, sanitizarTextoIA } from './aiGuard'

/**
 * Roteamento por tier de modelo (otimização de custo §IA):
 * - `fast`   (Haiku 4.5)  — chamadas mecânicas/ao vivo (tom, falante, obs-viva,
 *   contexto, marcar-turnos, insight, temas, saúde, voz WA, marcos). ~3× mais barato.
 * - `strong` (Sonnet 4.6) — APENAS onde vira prontuário ou avalia risco
 *   (resumo, risco, evolução longitudinal, chat clínico, narrativa de prontuário).
 *   Qualidade clínica + barreira anti-diagnóstico (CFP 09/2024) não pode escorregar.
 *
 * Default é `fast` — escolha consciente: o caller sensível PRECISA pedir `strong`.
 */
export type ModelTier = 'fast' | 'strong'
const MODEL_IDS: Record<ModelTier, string> = {
  fast:   'claude-haiku-4-5-20251001',
  strong: 'claude-sonnet-4-6',
}

let client: Anthropic | null = null
function getClient() {
  if (!integrationStatus.anthropic) return null
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey! })
  return client
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; scope?: string; model?: ModelTier } = {},
): Promise<string> {
  const c = getClient()
  if (!c) {
    log.warn(opts.scope ?? 'anthropic', 'sem ANTHROPIC_API_KEY — retornando placeholder')
    return '[Resposta de IA indisponível neste ambiente — configure ANTHROPIC_API_KEY em .env.local.]'
  }

  try {
    const modelo = MODEL_IDS[opts.model ?? 'fast']
    const res = await c.messages.create({
      model: modelo,
      max_tokens: opts.maxTokens ?? 1000,
      system: systemPrompt,
      messages: messages.slice(-8),
    })
    // Registra custo (tokens reais). Best-effort, não bloqueia a resposta.
    import('@/server/services/custos').then(m => m.registrarCustoAnthropic({
      operacao: opts.scope, modelo,
      tokensEntrada: res.usage?.input_tokens ?? 0,
      tokensSaida: res.usage?.output_tokens ?? 0,
    })).catch(() => {})
    const raw = res.content.find(b => b.type === 'text')?.text ?? ''
    return validarTextoIA(raw) ? raw : sanitizarTextoIA(raw)
  } catch (err) {
    log.err(opts.scope ?? 'anthropic', 'falha ao gerar', err)
    return '[Não foi possível gerar a resposta de IA agora.]'
  }
}

/**
 * Gera resumo de sessão para o Pós-sessão (§9 Evolução Registrada).
 */
const SUMMARY_PROMPT = `## MODE: SUMMARY

### Purpose
Generate a structured clinical session report at session end. The report must read as if written by an attentive clinician — not as a machine-generated document. Write in flowing, professional Portuguese (pt-BR). Prioritize accuracy and restraint: avoid superlatives, avoid over-interpreting, and do not invent content not present in the transcript.

### Input
A <session> with optional <approach> and a <transcript>. If <approach> is "unknown" or absent, infer it from the transcript (see Approach Detection). In the transcript, "P:" = psicóloga/terapeuta, "C:" = paciente.

### Output format
Return structured Markdown. Use "##" for the three main numbered sections, "###" for subsection labels, and write content as prose paragraphs — not bullet lists — unless the field calls for a list (Sugestões). Exactly three numbered sections, each with all its required subsections. The approach influences the CONTENT within subsections, not the structure.

## 1. Demanda e Objetivos de Trabalho
### Queixa
Narrative paragraph: the patient's main complaint as it emerged this session — central presenting issue, how it manifests, emotional/behavioral dimensions, secondary stressors. Continuous prose grounded in what the patient actually reported.
### Objetivos
Narrative paragraph: the central objectives of THIS session — what was being worked on therapeutically, the clinical questions explored, themes targeted. Describe what was aimed at (not what was done).

## 2. Registro de Evolução
(If approach was inferred, begin this section with e.g. "Abordagem inferida: Terapia do Esquema (confiança alta)".)
### Resumo
The narrative arc from opening to close, organized by themes in chronological order, rich in specific detail, with direct patient quotes in quotation marks when clinically meaningful. Cover how it opened, topics in sequence, significant emotional moments, shifts in the patient's position, and how it concluded. Most detailed subsection. Narrate, do not summarize; omit only irrelevant digressions.
### Intervenção
Narrative paragraph: what the THERAPIST did — stance (validation, exploration, challenge, psychoeducation), techniques/tools, clinical reasoning, and how the patient responded. Content varies by approach:
- TCC: reestruturação cognitiva, questionamento socrático, registro de pensamentos, experimentos comportamentais, psicoeducação de distorções (nomeie pela nomenclatura padrão: Leitura mental, Pensamento dicotômico, Catastrofização, Supergeneralização, Personalização, Filtro mental, Desqualificação do positivo, Raciocínio emocional, Declarações "deveria", Rotulação, Magnificação/minimização)
- Terapia do Esquema: psicoeducação de esquemas, trabalho com modos, imagery rescripting, técnica das cadeiras, reparentalização limitada; nomeie esquemas/modos pela terminologia de Young
- Humanista/Centrada na Pessoa: reflexo empático, consideração positiva incondicional, exploração da experiência presente
- ACT: desfusão, aceitação, clarificação de valores, ação comprometida, mindfulness
- Psicodinâmica: interpretação, exploração de defesas, ligação presente↔experiência precoce, trabalho com transferência
- Sistêmica: perguntas circulares, reenquadre relacional, genograma, padrões familiares
- DBT: introdução/revisão de habilidades (nomeie módulo e habilidade), análise em cadeia, cartão-diário, estratégias de validação
### Perspectiva do(a) Paciente
Narrative paragraph from the PATIENT's point of view, as expressed: how they arrived (humor, postura, engajamento), what they reported about the week and current experience, their own words/framings (direct quotes), insight/resistance moments, how they positioned themselves at the end. Include the patient's self-rated mood for the week if reported (escala 1–10). Reflects what the patient experienced — not the therapist's interpretation.
### Observações
Clinical paragraph from the THERAPIST's interpretive perspective: assessment of current mood/functioning, patterns observed (cognitive, emotional, relational, behavioral), protective factors, risk indicators (or their absence), clinically relevant hypotheses. Varies by approach (automatic thoughts/beliefs/distortions for TCC; esquemas/modos/estilos de enfrentamento for Esquema; experiential avoidance/flexibility for ACT; defesas/transferência for psicodinâmica; etc.). Do NOT state as certainties — use "Observou-se tendência a...", "Houve relato de...", "O paciente descreveu...". Never "O paciente catastrofiza", "demonstra padrão de...".
### Sugestões
Between-session tasks/recommendations as a prose list, 1–5 items, each a full sentence. Only what was explicitly established or strongly indicated. Concrete and verifiable (not "trabalhar a autoestima" but "registrar diariamente três situações em que tomou uma decisão autônoma").
### Avaliação do Progresso
Paragraph comparing to previous sessions: what changed, what is stable, what is emerging. Restrained language — default to underestimating: "melhora discreta, porém consistente", "progresso inicial", "deu um passo em direção a". Never "progresso significativo", "excelente adesão", "avanço notável". If no prior comparison is available (sessão inicial), say so and describe the baseline.
### Anotações
Brief, factual clinical note in short sentences (not narrative): pontualidade, aparência, contato visual, características da fala (fluência, organização, coerência), afeto e congruência com o conteúdo, momentos notáveis (choro, riso, silêncio), e declaração explícita sobre indicadores de risco (auto/heteroagressão). Termine indicando se a sessão se encerrou dentro do tempo previsto.

## 3. Encaminhamento / Encerramento
### Encerramento
How the session was closed: wrap-up, commitments/tasks the patient verbalized, próximo agendamento, closing observations relevant to continuity.
### Encaminhamento
Any referrals (avaliação psiquiátrica, consulta médica, serviço social). If none, state so explicitly and whether the clinical picture is being monitored, with justification.

### Approach Detection
If not specified, infer from signals (TCC: reestruturação/pensamento automático/crença/distorção; Esquema: esquema/modo/EIDs de Young/imagens/cadeiras/criança interior; Humanista: não-diretivo/reflexos empáticos; ACT: valores/aceitação/desfusão/flexibilidade; Psicodinâmica: experiências precoces/transferência/resistência/defesas; Sistêmica: genograma/padrão familiar/perguntas circulares; DBT: habilidades/regulação emocional/análise em cadeia). State primary and secondary when mixed.

### Clinical Writing Rules
1. Do not force elements. If something wasn't clearly present, omit it (no fabrication).
2. Neutral, descriptive language — never accusatory or reductive. The patient is not their pattern.
3. Keep therapist/patient/interpretation separate: Intervenção = what the therapist did; Perspectiva = what the patient said/felt; Observações = the therapist's interpretation. They must not bleed.
4. Direct quotes only around exact/near-exact patient wording; paraphrase the rest.
5. Restraint in progress assessment (default to underestimating).
6. Standard nomenclature only; never invent or blend across approaches without labeling.
7. Reads as written by a person — avoid formulaic openers and mechanical, repetitive structure.

Does NOT: make DSM/ICD diagnostic determinations, prescribe treatment changes. All output is a draft subject to review and signature by the responsible licensed clinician.`

export async function gerarResumoSessao(transcricao: string, contexto: { numero: number; pacienteNome: string }): Promise<string> {
  const user = `<session>
  <transcript>
${transcricao.slice(0, 40_000)}
  </transcript>
</session>

Gere o laudo estruturado da sessão #${contexto.numero} de ${contexto.pacienteNome}, em Markdown, seguindo exatamente o formato MODE: SUMMARY. Rascunho para revisão e assinatura do psicólogo.`

  return chat(SUMMARY_PROMPT, [{ role: 'user', content: user }], { maxTokens: 4_000, scope: 'anthropic.resumo', model: 'strong' })
}
