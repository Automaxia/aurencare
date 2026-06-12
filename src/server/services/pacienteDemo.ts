import 'server-only'
import { db } from '@/server/db/pool'
import { encrypt } from '@/server/lib/crypto'
import { chat } from '@/server/lib/anthropic'
import { log } from '@/server/lib/log'
import { dataBrasiliaISO } from '@/lib/formatters'
import { criarObjetivo, registrarMedicao, atualizarObjetivo } from './objetivos'
import { criarGas, registrarAndamentoGas } from './gasObjetivos'

/**
 * Paciente de demonstração "Maria Joana" — fictício, rico e coerente, pra
 * testar funcionalidades de continuidade e apresentar o produto a psicólogos
 * (beta/pós-lançamento).
 *
 * A ESTRUTURA é determinística (datas, indicadores, métricas, temas) pra que
 * gráficos, objetivos e grafo de temas fiquem consistentes entre si. A PROSA
 * (resumos e trechos de transcrição das sessões) é gerada pela IA na criação,
 * com fallback determinístico se a API falhar — a demo nunca quebra.
 *
 * Marcado com pacientes.demo = TRUE: badge na UI e remoção em 1 clique.
 */

const NOME_DEMO = 'Maria Joana (demonstração)'
const TEL_DEMO = '5511988887777'

// ── Persona + arco clínico (12 semanas, melhora progressiva) ────────────────
const PERSONA = `Maria Joana, 34 anos, professora do ensino fundamental, São Paulo/SP. Casada.
Procurou terapia por ansiedade ligada a desempenho e medo de julgamento, com evitação de
conflitos (no trabalho com o chefe e na relação com o pai) e ruminação noturna. Ao longo do
acompanhamento, passa de evitação dominante a exposições bem-sucedidas.`

type Passo = {
  /** semanas atrás (sessão #1 = mais antiga) */
  semanasAtras: number
  humorEstado: number   // -5..+5 (checagem de humor)
  ritmoPac: number      // % de fala do paciente
  evitSemana: number    // episódios de evitação/semana (objetivo 1)
  gasNivel: number       // -2..+2 (objetivo 2, acompanhamento GAS)
  foco: string          // bullet factual da sessão (alimenta a IA)
}

const ARCO: Passo[] = [
  { semanasAtras: 11, humorEstado: -3, ritmoPac: 52, evitSemana: 5, gasNivel: -1,
    foco: 'Primeira sessão. Evitação dominante; ansiedade antecipatória antes de reuniões; ruminação noturna frequente. Relata vergonha após se calar diante do chefe.' },
  { semanasAtras: 9, humorEstado: -2, ritmoPac: 54, evitSemana: 4, gasNivel: -1,
    foco: 'Reconhece o padrão de evitação e nomeia o medo de julgamento como gatilho central.' },
  { semanasAtras: 7, humorEstado: -2, ritmoPac: 56, evitSemana: 4, gasNivel: 0,
    foco: 'Articula a ligação entre o padrão no trabalho e a relação com o pai (evitar conflito, ruminar depois).' },
  { semanasAtras: 5, humorEstado: -1, ritmoPac: 58, evitSemana: 3, gasNivel: 0,
    foco: 'Primeira estratégia concreta: respiração antes de falar em reunião. Tensão corporal observada (ombros), seguida de sensação de orgulho.' },
  { semanasAtras: 3, humorEstado: 0, ritmoPac: 60, evitSemana: 2, gasNivel: 1,
    foco: 'Consolidação. Redução da ruminação noturna; respostas assertivas mais frequentes. Esposa percebe a mudança.' },
  { semanasAtras: 1, humorEstado: 2, ritmoPac: 62, evitSemana: 1, gasNivel: 1,
    foco: 'Exposição bem-sucedida: realizou apresentação apesar da ansiedade e foi elogiada. Melhora clara desde a primeira sessão.' },
]

// ── Temas (grafo) — palavras e co-ocorrências ───────────────────────────────
const PALAVRAS: Array<{ p: string; cluster: string; f: number }> = [
  { p: 'ansiedade', cluster: 'emocional', f: 18 },
  { p: 'medo', cluster: 'emocional', f: 12 },
  { p: 'vergonha', cluster: 'emocional', f: 7 },
  { p: 'alívio', cluster: 'emocional', f: 5 },
  { p: 'chefe', cluster: 'relacional', f: 11 },
  { p: 'pai', cluster: 'relacional', f: 9 },
  { p: 'esposa', cluster: 'relacional', f: 5 },
  { p: 'reunião', cluster: 'situacional', f: 13 },
  { p: 'apresentação', cluster: 'situacional', f: 8 },
  { p: 'trabalho', cluster: 'situacional', f: 10 },
  { p: 'julgamento', cluster: 'cognitivo', f: 10 },
  { p: 'ruminação', cluster: 'cognitivo', f: 9 },
  { p: 'evitação', cluster: 'cognitivo', f: 12 },
  { p: 'autocrítica', cluster: 'cognitivo', f: 6 },
]
const ARESTAS: Array<[string, string, number]> = [
  ['ansiedade', 'reunião', 9],
  ['ansiedade', 'apresentação', 6],
  ['evitação', 'pai', 7],
  ['evitação', 'chefe', 6],
  ['julgamento', 'chefe', 6],
  ['ruminação', 'trabalho', 5],
  ['medo', 'julgamento', 8],
  ['vergonha', 'reunião', 4],
  ['apresentação', 'alívio', 4],
  ['esposa', 'alívio', 3],
]

type Prosa = { resumo: string; transcricao: string }

/** Gera resumo + trecho de transcrição de cada sessão via IA, com fallback. */
async function gerarProsa(): Promise<Prosa[]> {
  const sys = `Você apoia a continuidade clínica de psicólogos. Escreve em português brasileiro,
em linguagem de OBSERVAÇÃO e FREQUÊNCIA, NUNCA diagnóstica ou interpretativa (CFP 09/2024).
Não use "a paciente tem", "transtorno", "esquema de". Use "observa-se", "frequência crescente",
"co-ocorre", "padrão observado".`

  const user = `Paciente fictícia para demonstração do produto:
${PERSONA}

Gere o conteúdo de ${ARCO.length} sessões assinadas (da #1 mais antiga à #${ARCO.length} mais recente).
Para CADA sessão use o foco abaixo:
${ARCO.map((a, i) => `Sessão #${i + 1}: ${a.foco}`).join('\n')}

Para cada sessão devolva:
- "resumo": 2 a 3 frases observacionais que um psicólogo leria no prontuário (sem diagnóstico).
- "transcricao": um trecho curto de diálogo (4 a 6 linhas) no formato "P:" (psicóloga) e "C:" (cliente).

Responda SOMENTE com um array JSON válido de ${ARCO.length} objetos {"resumo","transcricao"}, sem texto em volta.`

  try {
    const raw = await chat(sys, [{ role: 'user', content: user }], {
      scope: 'demo.maria', maxTokens: 2200, model: 'strong',
    })
    const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
    const arr = JSON.parse(json)
    if (Array.isArray(arr) && arr.length === ARCO.length && arr.every(x => x?.resumo && x?.transcricao)) {
      return arr.map((x: any) => ({ resumo: String(x.resumo), transcricao: String(x.transcricao) }))
    }
    throw new Error('formato inesperado')
  } catch (err) {
    log.warn('demo.maria', 'IA indisponível/inválida — usando prosa de fallback', err)
    return prosaFallback()
  }
}

/** Conteúdo determinístico (usado quando a IA não está disponível). */
function prosaFallback(): Prosa[] {
  return [
    { resumo: 'Sessão inicial. Observa-se padrão de evitação diante de figuras de autoridade e ansiedade antecipatória antes de reuniões. Relata ruminação noturna frequente e vergonha após se calar em situações de exposição.',
      transcricao: 'P: O que te trouxe à terapia agora?\nC: Toda reunião eu sinto ansiedade antes, e depois fico horas remoendo o que poderia ter dito.\nP: Notou alguma situação específica?\nC: Ontem meu chefe me interrompeu e eu simplesmente travei. Saí com vergonha.' },
    { resumo: 'Observa-se maior consciência do padrão: a paciente nomeia o medo de julgamento como gatilho central da evitação. Frequência de evitação ainda alta, porém já identificada.',
      transcricao: 'P: O que aparece logo antes de você se calar?\nC: Um pensamento de que vou falar besteira e vão me julgar.\nP: Esse pensamento aparece em outros lugares?\nC: Sempre que tem chance de errar na frente de alguém.' },
    { resumo: 'Co-ocorre, no relato, o padrão profissional e a relação com o pai: evitar o conflito e ruminar depois. Articulação espontânea da paciente entre os dois contextos.',
      transcricao: 'P: Esse jeito de evitar conflito lembra alguma relação?\nC: Com meu pai. Sempre engoli o que pensava e remoía por dias.\nP: E hoje?\nC: Percebo que faço igual no trabalho.' },
    { resumo: 'Primeira tentativa de estratégia: uso de respiração antes de falar em reunião. Observa-se tensão corporal (ombros) seguida de sensação de orgulho após a exposição.',
      transcricao: 'P: Como foi usar a respiração na terça?\nC: Respirei antes de falar e consegui colocar minha ideia, mesmo com o coração acelerado.\nP: O que notou no corpo?\nC: Tensão nos ombros, mas depois um orgulho que eu não sentia há tempos.' },
    { resumo: 'Consolidação do progresso: frequência crescente de respostas assertivas e redução da ruminação noturna. Mudança percebida também pela esposa.',
      transcricao: 'P: O que mudou nas noites?\nC: Durmo melhor, paro de remoer mais cedo.\nP: Alguém percebeu?\nC: Minha esposa disse que eu pareço mais leve.' },
    { resumo: 'Observa-se exposição bem-sucedida: apresentação realizada apesar da ansiedade, com retorno positivo. Redução marcante da evitação em relação às primeiras sessões.',
      transcricao: 'P: Como foi a apresentação?\nC: Fui, mesmo com medo. O chefe até elogiou.\nP: O que mudou desde a primeira sessão?\nC: Antes a evitação dominava. Agora noto a ansiedade chegando e ainda assim escolho responder.' },
  ]
}

/** True se o psicólogo já tem o paciente de demonstração. */
export async function temPacienteDemo(psicologoId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM pacientes WHERE psicologo_id = $1 AND demo = TRUE ORDER BY created_at ASC LIMIT 1`,
    [psicologoId],
  )
  return rows[0]?.id ?? null
}

/** Remove o(s) paciente(s) de demonstração e todos os dados (cascade). */
export async function removerPacienteDemo(psicologoId: string): Promise<void> {
  await db.query(`DELETE FROM pacientes WHERE psicologo_id = $1 AND demo = TRUE`, [psicologoId])
  log.ok('demo.maria', `removido (psi=${psicologoId})`)
}

/**
 * Cria a Maria Joana completa na conta do psicólogo. Idempotente: se já existir,
 * devolve o id existente sem duplicar.
 */
export async function criarPacienteDemo(psicologoId: string): Promise<string> {
  const existente = await temPacienteDemo(psicologoId)
  if (existente) return existente

  const condicoes = {
    cid: ['F41.1'],
    medicacoes: [{ nome: 'Escitalopram', dose: '10mg' }],
    alertas: ['Histórico de insônia associada a ruminação'],
    observacoes: 'Boa aliança terapêutica. Ansiedade ligada a desempenho e medo de julgamento; evitação de conflitos.',
  }
  const dadosCadastro = {
    nomeSocial: 'Maria Joana',
    genero: 'Mulher cis',
    racaCor: 'Parda',
    estadoCivil: 'Casado(a)',
    ocupacao: 'Professora (ensino fundamental)',
    formacao: 'Pedagogia',
    cidade: 'São Paulo', estado: 'SP', pais: 'Brasil',
    origem: 'Indicação',
    contatosEmergencia: [{ nome: 'Cônjuge', telefone: '(11) 90000-0000' }],
  }

  // ── Paciente (raw insert — sem disparar WhatsApp/email) ───────────────────
  const { rows: pr } = await db.query<{ id: string }>(
    `INSERT INTO pacientes
       (psicologo_id, nome, telefone, email, condicoes, dados_cadastro,
        consentimento_aceito, consentimento_timestamp, status, demo)
     VALUES ($1,$2,$3,$4,$5,$6, TRUE, NOW(), 'ativo', TRUE)
     ON CONFLICT (psicologo_id, telefone) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    [psicologoId, NOME_DEMO, TEL_DEMO, 'maria.joana@exemplo.com',
     JSON.stringify(condicoes), JSON.stringify(dadosCadastro)],
  )
  const pacienteId = pr[0].id

  const prosa = await gerarProsa()
  const agora = Date.now()
  const semana = 7 * 24 * 60 * 60 * 1000

  // ── Sessões assinadas (uma por passo do arco) ─────────────────────────────
  const sessaoDatas: string[] = []
  for (let i = 0; i < ARCO.length; i++) {
    const a = ARCO[i]
    const dt = new Date(agora - a.semanasAtras * semana)
    sessaoDatas.push(dt.toISOString())
    const indicadores = {
      ritmo: { psicologo: 100 - a.ritmoPac, paciente: a.ritmoPac },
      humor: { estado: a.humorEstado },
      risco: { autolesao: 'lo', ideacao: 'lo', plano: 'lo' },
    }
    await db.query(
      `INSERT INTO sessoes
         (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade,
          status, pagamento_status, pagamento_metodo, valor,
          assinada, assinatura_timestamp, resumo_ia, transcricao_texto, indicadores)
       VALUES ($1,$2,$3,$4,50,'online','concluida','pago','pix',220,
               TRUE,$5,$6,$7,$8)`,
      [psicologoId, pacienteId, i + 1, dt.toISOString(),
       dt.toISOString(), encrypt(prosa[i].resumo), encrypt(prosa[i].transcricao),
       JSON.stringify(indicadores)],
    )
  }

  // ── Próxima sessão agendada (pra "próxima sessão" acender no painel) ───────
  const proxima = new Date(agora + 3 * 24 * 60 * 60 * 1000)
  await db.query(
    `INSERT INTO sessoes
       (psicologo_id, paciente_id, numero, data_hora, duracao_min, modalidade,
        status, pagamento_status, pagamento_metodo, valor)
     VALUES ($1,$2,$3,$4,50,'online','confirmada','pago','pix',220)`,
    [psicologoId, pacienteId, ARCO.length + 1, proxima.toISOString()],
  )

  // ── Grafo de temas (palavras + co-ocorrências) ────────────────────────────
  for (const w of PALAVRAS) {
    await db.query(
      `INSERT INTO palavras_chave (paciente_id, palavra, cluster, frequencia)
       VALUES ($1,$2,$3,$4)`,
      [pacienteId, w.p, w.cluster, w.f],
    )
  }
  for (const [a, b, w] of ARESTAS) {
    await db.query(
      `INSERT INTO arestas_tema (paciente_id, palavra_a, palavra_b, weight)
       VALUES ($1,$2,$3,$4)`,
      [pacienteId, a, b, w],
    )
  }

  // ── Objetivo 1 (SMART/absoluta): reduzir evitação ─────────────────────────
  const obj1 = await criarObjetivo(pacienteId, {
    titulo: 'Reduzir episódios de evitação em situações de exposição',
    descricao: 'Diminuir a frequência semanal de situações em que evita falar/se posicionar por medo de julgamento.',
    metricaTipo: 'absoluta',
    metricaUnidade: 'episódios/semana',
    metricaBaseline: 5, metricaAlvo: 1, metricaDirecao: 'diminuir',
    prazoEm: dataBrasiliaISO(new Date(agora + 30 * 24 * 60 * 60 * 1000)),
  })
  for (let i = 0; i < ARCO.length; i++) {
    await registrarMedicao(obj1.id, {
      medidoEm: dataBrasiliaISO(sessaoDatas[i]),
      valor: ARCO[i].evitSemana,
      origem: 'sessao',
      nota: i === 0 ? 'Baseline na avaliação inicial.' : null,
    })
  }
  await atualizarObjetivo(obj1.id, { progresso: 85 })

  // ── Objetivo 2 (descritivo + GAS): regular ansiedade ao falar em público ──
  const obj2 = await criarObjetivo(pacienteId, {
    titulo: 'Regular a ansiedade antes de falar em público',
    descricao: 'Acompanhado por GAS — da evitação à exposição com ansiedade administrável.',
    metricaTipo: 'nenhuma',
  })
  const gas = await criarGas(obj2.id, {
    titulo: 'Falar em reuniões / apresentações',
    nivelM2: 'Evita completamente; falta ou se cala em toda exposição.',
    nivelM1: 'Participa, mas com sofrimento intenso e evitação parcial.',
    nivel0: 'Fala quando necessário, com ansiedade administrável.',
    nivelP1: 'Toma iniciativa de falar; ansiedade leve.',
    nivelP2: 'Conduz apresentações com tranquilidade.',
    nivelPartida: -1, nivelEsperado: 1,
  })
  for (let i = 0; i < ARCO.length; i++) {
    await registrarAndamentoGas(obj2.id, gas.id, ARCO[i].gasNivel, dataBrasiliaISO(sessaoDatas[i]))
  }
  await atualizarObjetivo(obj2.id, { progresso: 70 })

  log.ok('demo.maria', `criado (paciente=${pacienteId}, psi=${psicologoId})`)
  return pacienteId
}
