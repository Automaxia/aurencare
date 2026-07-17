import 'server-only'
import { chat } from './llm'

/**
 * COMPAT: o acesso ao LLM mora agora em `llm.ts` (multi-provedor — OpenAI
 * primário, Anthropic fallback). Este módulo reexporta `chat`/tipos para não
 * quebrar imports existentes (`@/server/lib/anthropic`) e mantém o helper de
 * alto nível `gerarLaudoFormal` (laudo, sob demanda) e `gerarResumoCurto` (resumo
 * da sessão, automático → continuidade). Prefira importar de `@/server/lib/llm`
 * em código novo.
 */
export { chat }
export type { ChatMessage, ModelTier } from './llm'

// Placeholder/detector da IA — fonte única em @/lib/ia (client-safe). Reexportado
// aqui porque há callers que importam de '@/server/lib/anthropic' (ex.: encerrar).
export { iaIndisponivel } from '@/lib/ia'

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

/**
 * LAUDO FORMAL (CFP) — documento estruturado e completo (modelo forte,
 * MODE: SUMMARY). Gerado SOB DEMANDA, só quando solicitado (CFP / pedido do
 * paciente): é esporádico e NÃO é o que dirige a continuidade. O que alimenta a
 * continuidade é o REGISTRO ASSINADO (resumo curto → resumo_ia). Ver
 * `gerarResumoCurto`.
 */
export async function gerarLaudoFormal(
  transcricao: string,
  contexto: { numero: number; pacienteNome: string; psicologoId: string; sessaoId: string; pacienteId: string },
  historico: { numero: number; resumo: string }[] = [],
): Promise<string> {
  // Laudos anteriores (cronológico) alimentam a seção "Avaliação do Progresso".
  // Cada um truncado pra controlar custo de tokens.
  const anteriores = historico.length
    ? `<previous_sessions>
${historico.map(h => `  <session numero="${h.numero}">\n${h.resumo.slice(0, 3_000)}\n  </session>`).join('\n')}
</previous_sessions>
Use os laudos acima APENAS para a seção "Avaliação do Progresso" (comparar o que mudou/persistiu/emergiu). Não os copie nas outras seções.\n\n`
    : ''

  const user = `${anteriores}<session>
  <transcript>
${transcricao.slice(0, 40_000)}
  </transcript>
</session>

Gere o laudo estruturado da sessão #${contexto.numero} de ${contexto.pacienteNome}, em Markdown, seguindo exatamente o formato MODE: SUMMARY. Rascunho para revisão e assinatura do psicólogo.${historico.length ? '' : ' Não há laudos anteriores — trate "Avaliação do Progresso" como linha de base (sessão inicial ou primeira com registro).'}`

  // cache: SUMMARY_PROMPT é grande e estável → cacheável no Sonnet (min 2048 tok).
  return chat(SUMMARY_PROMPT, [{ role: 'user', content: user }], {
    maxTokens: 4_000, scope: 'anthropic.resumo', model: 'strong', cache: true,
    psicologoId: contexto.psicologoId, sessaoId: contexto.sessaoId, pacienteId: contexto.pacienteId,
  })
}

/**
 * Estrutura do REGISTRO da sessão — 6 campos (spec do usuário, jul/2026).
 * Compartilhável entre o registro de continuidade (gerarResumoCurto) e, se
 * confirmado, o laudo formal. Princípio-guia: fidelidade ao que ocorreu NESTA
 * sessão, adaptando à natureza do encontro; não preencher lacunas nem forçar
 * estrutura de TCC; reportar honestamente campo sem conteúdo.
 */
const SESSION_NOTE_PROMPT = `Você redige o registro clínico de UMA sessão de psicoterapia, para revisão e assinatura do psicólogo responsável. Produza os 6 campos abaixo, em português (pt-BR) e em Markdown (use "## " no título de cada campo).

PRINCÍPIO-GUIA (vale para todos os campos): cada campo reflete fielmente o que ocorreu NESTA sessão, adaptando-se à natureza do encontro (acompanhamento regular, sessão pontual, triagem/primeiro contato, encerramento por imprevisto). NÃO preencha lacunas por padrão nem force a estrutura típica de TCC quando o conteúdo real da sessão não a sustenta. Na ausência de conteúdo relevante para um campo, diga isso de forma breve e honesta (ex.: "Não houve indicação de tarefas específicas nesta sessão de triagem") em vez de gerar conteúdo genérico ou inferido.

## 1. Resumo da sessão
~90–130 palavras. Síntese do conteúdo clínico central: tema principal trabalhado, contexto trazido pelo paciente, conceitos ou técnicas discutidas. Amarre causa e efeito quando relevante (ex.: mudança de comportamento associada a uma intervenção específica). NÃO é cronológico — é temático.

## 2. Encerramento
~40–60 palavras. Como a sessão foi finalizada, conforme a natureza do encontro:
- Acompanhamento regular: feedback do paciente sobre o que foi trabalhado, reações à postura do terapeuta, desconfortos ou concordâncias explicitados no fechamento.
- Sessão pontual/orientação específica: como o objetivo pontual foi endereçado e se houve fechamento explícito daquele propósito.
- Triagem/primeiro contato: sinais sobre a decisão de prosseguir (ou não) o tratamento, alinhamento de expectativas.
- Encerramento abrupto (tempo/imprevisto): motivo da interrupção e qual tópico ficou em aberto.
Reporte apenas o que de fato ocorreu — não infira feedback ou fechamento que não foi verbalizado.

## 3. Intervenção do psicólogo
~90–130 palavras. Foco EXCLUSIVO no que o terapeuta fez tecnicamente: reestruturações, validações, técnicas ou perguntas usadas, com nome técnico quando aplicável (reestruturação cognitiva, validação, psicoeducação). NÃO descreva a reação do paciente — só a ação clínica. Em sessões de triagem, a "intervenção" pode ser majoritariamente escuta ativa e levantamento de histórico, não técnica formal — reporte como tal, sem forçar linguagem de reestruturação cognitiva onde não houve.

## 4. Perspectiva do paciente
~90–130 palavras. Relato do paciente em DISCURSO INDIRETO, sem citação literal. O que ele trouxe, como descreveu seu estado, contradições ou ambivalências expressas (ex.: satisfação e medo de recaída simultâneos).

## 5. Observações
4–5 frases curtas, telegráficas, SEM conectivos. Inferências clínicas do terapeuta sobre padrões — não fatos relatados diretamente pelo paciente, mas leituras sobre progresso, risco ou mudança de padrão. É a ÚNICA seção interpretativa.

## 6. Sugestões
4–5 frases curtas, no INFINITIVO — quando aplicável. Orientações práticas ligadas ao que foi discutido. Em sessões de triagem ou primeiro contato pode não haver tarefas no sentido tradicional — nesse caso, reporte o que ficou definido quanto à continuidade (ex.: "Confirmar disponibilidade para a próxima sessão", "Refletir sobre a adequação da abordagem proposta").

REGRAS DE ESTILO (todos os campos):
- Terceira pessoa, tempo verbal passado, tom técnico-impessoal.
- NUNCA citação literal do paciente. Não use aspas em torno de falas, expressões ou termos ditos pelo paciente — descreva sempre em discurso indireto (ex.: em vez de o paciente relatou sentir-se "um lixo", escreva: o paciente relatou sentimento de inadequação/autodepreciação).
- Vocabulário técnico prioritariamente TCC (causalidade vs. correlação, reestruturação cognitiva, autocompaixão, esquiva, efeito rebote), mas não exclusivo — a estrutura não deve depender desse vocabulário para funcionar.
- Sem juízo de valor moral, só clínico.
- Não faz determinação diagnóstica (DSM/ICD). Tudo é rascunho sujeito a revisão e assinatura do psicólogo responsável.`

/**
 * REGISTRO da sessão — 6 campos (SESSION_NOTE_PROMPT). Gerado automaticamente no
 * encerramento com o modelo fast (barato, toda sessão). Depois de revisado e
 * assinado (vira resumo_ia), é ele que dirige a continuidade (temas, evolução,
 * "preparar próxima"). Mantido no tier fast pra preservar margem; o laudo formal
 * (`gerarLaudoFormal`, modelo forte) segue sendo o documento sob demanda.
 * (nome mantido `gerarResumoCurto` por compatibilidade dos callers.)
 */
export async function gerarResumoCurto(
  transcricao: string,
  contexto: { numero: number; pacienteNome: string; psicologoId: string; sessaoId: string; pacienteId: string },
): Promise<string> {
  const user = `<session numero="${contexto.numero}">
  <transcript>
${transcricao.slice(0, 40_000)}
  </transcript>
</session>

Gere o registro da sessão #${contexto.numero} de ${contexto.pacienteNome}, com os 6 campos, seguindo o princípio-guia. Rascunho para revisão e assinatura do psicólogo.`
  return chat(SESSION_NOTE_PROMPT, [{ role: 'user', content: user }], {
    maxTokens: 1_100, scope: 'resumo.curto', model: 'fast',
    psicologoId: contexto.psicologoId, sessaoId: contexto.sessaoId, pacienteId: contexto.pacienteId,
  })
}
